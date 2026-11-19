import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Models } from 'react-native-appwrite';
import { executeFunction, functionIds, listAllRows, Query, tableIds } from '../../backend';
import { useAccountGuard } from '../appwrite-tools/account-scope';
import { radius, resolveTextStyle, spacing, usePensumTheme } from '../../theme';
import { AppText, Button, ErrorState, Field, LoadingState, Screen, Segmented } from '../../ui';
import { BottomSheet } from '../../ui/BottomSheet';
import { confirmAction, consentToGemini, errorText, useToolAction } from '../appwrite-tools/actions';
import { pickPhoto, prepareImage, removeTemporaryFile, type ImageSource } from '../appwrite-tools/images';
import { putHandoff } from '../shared/handoff';
import { splitMessage } from './message-parts';
import { SolutionWindow } from './SolutionWindow';

type Chat = { id: string; title: string; updatedAt: string };
type ChatRow = Models.Row & { title: string };
type MessageRow = Models.Row & { role: 'user' | 'model'; text: string };
type Step = { id: string; label: string; detail: string; ms?: number };
type Message = { id: string; role: MessageRow['role']; text: string; steps?: Step[] };
type ChatReply = { chat: Chat; reply: { id: string; text: string }; steps?: Step[] };
type Attachment = { kind: 'image'; photo: ImageSource } | { kind: 'pdf'; uri: string; name: string };

const grades = ['8', '9', '10', '11', '12'] as const;
const pdfBytesMax = 2_600_000;

function byUpdated(a: Chat, b: Chat) {
  return b.updatedAt.localeCompare(a.updatedAt);
}

function IconButton({ icon, label, onPress, disabled, filled }: {
  icon: SymbolViewProps['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
  filled?: boolean;
}) {
  const { colors } = usePensumTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} accessibilityState={{ disabled }} onPress={onPress}
      style={({ pressed }) => [styles.iconButton, {
        backgroundColor: filled ? colors.ink : pressed ? colors.border : colors.surface,
        opacity: disabled ? 0.45 : pressed && filled ? 0.75 : 1,
      }]}>
      <SymbolView name={icon} size={19} tintColor={filled ? colors.onPrimary : colors.ink} />
    </Pressable>
  );
}

export function KiChatScreen({ userId }: { userId: string }) {
  const router = useRouter();
  const action = useToolAction();
  const requireAccount = useAccountGuard();
  const { colors, scheme, customFonts } = usePensumTheme();
  const { width, fontScale } = useWindowDimensions();
  const { left, right } = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const wide = width - left - right >= 760 && fontScale <= 1.25;
  const conversationInset = { paddingHorizontal: wide ? spacing.xl : spacing.md };
  const messageScroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [active, setActive] = useState<Chat | null>(null);
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachment, setAttachment] = useState<Attachment>();
  const [grade, setGrade] = useState<(typeof grades)[number]>('8');
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<'compose' | 'chat'>();
  const [pendingMessage, setPendingMessage] = useState<string>();
  const [chatTitle, setChatTitle] = useState('');
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [listAttempt, setListAttempt] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const attachmentUri = attachment?.kind === 'pdf' ? attachment.uri : undefined;

  useEffect(() => {
    let mounted = true;
    setListLoading(true);
    listAllRows<ChatRow>(tableIds.chats, [Query.equal('userId', userId)], requireAccount)
      .then((rows) => {
        if (!mounted) return;
        setChats(rows.map((row) => ({ id: row.$id, title: row.title, updatedAt: row.$updatedAt })).sort(byUpdated));
        setListError('');
      })
      .catch((reason: unknown) => { if (mounted) setListError(errorText(reason)); })
      .finally(() => { if (mounted) setListLoading(false); });
    return () => { mounted = false; };
  }, [listAttempt, requireAccount, userId]);

  useEffect(() => () => { if (attachmentUri) removeTemporaryFile(attachmentUri); }, [attachmentUri]);

  useEffect(() => {
    if (!messages.length && pendingMessage === undefined) return;
    const frame = requestAnimationFrame(() => messageScroll.current?.scrollToEnd({ animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [messages, pendingMessage]);

  function open(chat: Chat) {
    setMenu(false);
    if (chat.id === active?.id) return;
    void action.run(async () => {
      const rows = await listAllRows<MessageRow>(tableIds.chatMessages, [Query.equal('chatId', chat.id)], requireAccount);
      const history = rows
        .sort((a, b) => a.$createdAt.localeCompare(b.$createdAt) || (a.role === b.role ? 0 : a.role === 'user' ? -1 : 1))
        .map((row) => ({ id: row.$id, role: row.role, text: row.text }));
      setActive(chat);
      setChatTitle(chat.title);
      setMessages(history);
      setExpanded(null);
      setText('');
      setAttachment(undefined);
    });
  }

  function newChat() {
    Keyboard.dismiss();
    setActive(null);
    setChatTitle('');
    setMessages([]);
    setText('');
    setAttachment(undefined);
    setExpanded(null);
    setMenu(false);
    setSheet(undefined);
    action.setError('');
  }

  function choosePhoto() {
    void action.run(async () => {
      const photo = await pickPhoto('library');
      if (photo) setAttachment({ kind: 'image', photo });
      setSheet(undefined);
    });
  }

  function choosePdf() {
    void action.run(async () => {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
      const selected = result.assets?.[0];
      if (!selected) { setSheet(undefined); return; }
      try {
        const size = selected.size ?? new File(selected.uri).size;
        if (!size || size > pdfBytesMax) throw new Error('Wähle ein PDF bis 2,6 MB.');
        setAttachment({ kind: 'pdf', uri: selected.uri, name: selected.name });
        setSheet(undefined);
      } catch (reason) {
        removeTemporaryFile(selected.uri);
        throw reason;
      }
    });
  }

  function send() {
    const prompt = text.trim();
    if (!prompt && !attachment) return;
    Keyboard.dismiss();
    void action.run(async () => {
      if (!await consentToGemini(attachment ? 'Deine Nachricht, der relevante Chatverlauf und der ausgewählte Anhang' : 'Deine Nachricht und der relevante Chatverlauf')) return;
      const sentText = prompt || (attachment?.kind === 'pdf' ? 'PDF gesendet' : 'Foto gesendet');
      setPendingMessage(sentText);
      try {
        let image: string | undefined;
        if (attachment?.kind === 'image') image = (await prepareImage(attachment.photo)).base64;
        if (attachment?.kind === 'pdf') {
          image = await new File(attachment.uri).base64();
          if (image.length > 3_500_000) throw new Error('Das PDF ist zu groß.');
        }
        requireAccount();
        const result = await executeFunction<ChatReply>(functionIds.kiChat, {
          action: 'send', chatId: active?.id, text: prompt, grade: Number(grade), image,
        });
        setChats((list) => [result.chat, ...list.filter((chat) => chat.id !== result.chat.id)].sort(byUpdated));
        setActive(result.chat);
        setChatTitle(result.chat.title);
        setMessages((value) => [
          ...value,
          { id: `local-${result.reply.id}`, role: 'user', text: sentText },
          { id: result.reply.id, role: 'model', text: result.reply.text, steps: result.steps },
        ]);
        setText('');
        setAttachment(undefined);
      } finally {
        setPendingMessage(undefined);
      }
    });
  }

  function rename() {
    const title = chatTitle.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!active || !title || title === active.title) return;
    void action.run(async () => {
      requireAccount();
      const result = await executeFunction<{ title: string }>(functionIds.kiChat, { action: 'rename', chatId: active.id, title });
      const chat = { ...active, title: result.title };
      setActive(chat);
      setChatTitle(chat.title);
      setChats((items) => items.map((item) => item.id === chat.id ? chat : item));
      setSheet(undefined);
    });
  }

  function remove() {
    if (!active) return;
    void action.run(async () => {
      if (!await confirmAction('Chat löschen?', 'Die Unterhaltung wird aus deinem Konto gelöscht.', 'Löschen', true)) return;
      requireAccount();
      await executeFunction(functionIds.kiChat, { action: 'delete', chatId: active.id });
      setChats((items) => items.filter((chat) => chat.id !== active.id));
      newChat();
    });
  }

  const chatList = (
    <View style={styles.history}>
      <View style={styles.historyHeader}>
        <AppText variant="section" accessibilityRole="header">Deine Chats</AppText>
        {!wide ? <IconButton icon="xmark" label="Chatliste schließen" onPress={() => setMenu(false)} /> : null}
      </View>
      <ScrollView contentContainerStyle={styles.historyList} keyboardShouldPersistTaps="handled">
        {listLoading ? <LoadingState title="Chats werden geladen" /> : null}
        {listError ? <ErrorState message={listError} onRetry={() => setListAttempt((value) => value + 1)} /> : null}
        {!listLoading && !listError && !chats.length ? <AppText tone="muted" variant="bodySm">Noch keine Chats</AppText> : null}
        {chats.map((chat) => (
          <Pressable key={chat.id} accessibilityRole="button" accessibilityState={{ selected: active?.id === chat.id, disabled: action.busy }}
            disabled={action.busy} onPress={() => open(chat)} style={({ pressed }) => [
              styles.historyItem, { backgroundColor: active?.id === chat.id ? colors.accentSurface : pressed ? colors.border : 'transparent' },
            ]}>
            <AppText variant="bodySm" numberOfLines={2}>{chat.title || 'Chat'}</AppText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  const body = resolveTextStyle('body', { customFonts });
  return (
    <Screen scroll={false} navigationTitle="KI-Chat" contentStyle={styles.screen}>
      <KeyboardAvoidingView style={styles.workspace} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={headerHeight}>
        {wide ? <View style={[styles.sidebar, { backgroundColor: colors.surface, borderRightColor: colors.border }]}>{chatList}</View> : null}
        <View style={styles.conversation}>
          <View style={[styles.chatHeader, conversationInset, { borderBottomColor: colors.hairlineSoft }]}>
            {!wide ? <IconButton icon="line.3.horizontal" label="Chatliste öffnen" disabled={action.busy} onPress={() => {
              Keyboard.dismiss();
              setMenu(true);
            }} /> : null}
            <AppText variant="fieldLabel" accessibilityRole="header" numberOfLines={1} style={styles.chatTitle}>{active?.title || 'Neuer Chat'}</AppText>
            {active ? <IconButton icon="ellipsis" label="Chat verwalten" disabled={action.busy} onPress={() => {
              Keyboard.dismiss();
              action.setError('');
              setChatTitle(active.title);
              setSheet('chat');
            }} /> : null}
          </View>

          <ScrollView ref={messageScroll} style={styles.messageScroll} contentContainerStyle={[styles.messageContent, conversationInset]}
            keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
            {messages.length === 0 && pendingMessage === undefined ? (
              <View style={styles.empty}>
                <AppText variant="h2" accessibilityRole="header" style={styles.emptyTitle}>Wie kann ich dir helfen?</AppText>
              </View>
            ) : null}
            {messages.map((message) => {
              const user = message.role === 'user';
              return (
                <View key={message.id} style={user ? [styles.userMessage, { backgroundColor: colors.accentSurface }] : styles.reply}>
                  <AppText variant="caption" tone={user ? 'muted' : 'accent'}>{user ? 'Du' : 'Gemini'}</AppText>
                  {user ? <AppText selectable>{message.text}</AppText> : splitMessage(message.text).map((part, index) => (
                    part.kind === 'solution'
                      ? <SolutionWindow key={index} text={part.text} disabled={action.busy} onGoodnotes={(solution) => {
                        putHandoff(solution, 'KI-Chat');
                        router.push('/tools/goodnotes');
                      }} />
                      : <AppText key={index} selectable>{part.text}</AppText>
                  ))}
                  {message.steps?.length ? (
                    <>
                      <Button title={expanded === message.id ? 'Schritte ausblenden' : message.steps.length + ' Schritte anzeigen'} variant="plain" size="sm"
                        style={styles.alignStart} onPress={() => setExpanded(expanded === message.id ? null : message.id)} />
                      {expanded === message.id ? message.steps.map((step) => (
                        <AppText variant="bodySm" tone="muted" key={step.id}>{step.label}{step.detail ? ' · ' + step.detail : ''}</AppText>
                      )) : null}
                    </>
                  ) : null}
                </View>
              );
            })}
            {pendingMessage !== undefined ? (
              <>
                <View style={[styles.userMessage, { backgroundColor: colors.accentSurface }]}>
                  <AppText variant="caption" tone="muted">Du</AppText>
                  <AppText>{pendingMessage}</AppText>
                </View>
                <View style={styles.typing} accessibilityLiveRegion="polite">
                  <ActivityIndicator color={colors.ink} />
                  <AppText variant="bodySm" tone="muted">Gemini antwortet …</AppText>
                </View>
              </>
            ) : null}
          </ScrollView>

          <View style={[styles.composer, conversationInset]}>
            {action.error && !sheet ? <ErrorState message={action.error} /> : null}
            {attachment ? (
              <View style={[styles.attachment, { backgroundColor: colors.surface }]}>
                <AppText variant="bodySm" numberOfLines={1} style={styles.attachmentName}>{attachment.kind === 'pdf' ? attachment.name : 'Foto ausgewählt'}</AppText>
                <IconButton icon="xmark" label="Anhang entfernen" disabled={action.busy} onPress={() => setAttachment(undefined)} />
              </View>
            ) : null}
            <View style={styles.composerRow}>
              <View style={[styles.inputGroup, { backgroundColor: colors.field, borderColor: colors.border }]}>
                <IconButton icon="plus" label="Anhänge und Klassenstufe" disabled={action.busy} onPress={() => {
                  Keyboard.dismiss();
                  action.setError('');
                  setSheet('compose');
                }} />
                <TextInput accessibilityLabel="Nachricht" placeholder="Nachricht" placeholderTextColor={colors.muted} selectionColor={colors.accent}
                  keyboardAppearance={scheme} value={text} onChangeText={setText} maxLength={4000} multiline editable={!action.busy}
                  style={[styles.input, { color: colors.ink, fontSize: body.fontSize, fontFamily: body.fontFamily }]} />
                <IconButton icon="arrow.up" label="Nachricht senden" filled disabled={action.busy || (!text.trim() && !attachment)} onPress={send} />
              </View>
              <IconButton icon="square.and.pencil" label="Neuen Chat erstellen" disabled={action.busy} onPress={newChat} />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={menu && !wide} transparent animationType="fade" onRequestClose={() => setMenu(false)}
        supportedOrientations={['portrait', 'portrait-upside-down', 'landscape']}>
        <View style={styles.drawerFrame}>
          <Pressable accessible={false} style={styles.drawerBackdrop} onPress={() => setMenu(false)} />
          <SafeAreaView edges={['top', 'bottom', 'left']} style={[styles.drawer, { backgroundColor: colors.canvas }]} accessibilityViewIsModal>
            {chatList}
          </SafeAreaView>
        </View>
      </Modal>

      <BottomSheet visible={sheet === 'chat'} title="Chat verwalten" busy={action.busy} onClose={() => setSheet(undefined)}>
        {action.error ? <ErrorState message={action.error} /> : null}
        <Field label="Chatname" value={chatTitle} onChangeText={setChatTitle} maxLength={60} editable={!action.busy} />
        <Button title="Umbenennen" disabled={action.busy || !chatTitle.trim() || chatTitle.trim() === active?.title} onPress={rename} />
        <Button title="Chat löschen" variant="plain" disabled={action.busy} onPress={remove} />
      </BottomSheet>

      <BottomSheet visible={sheet === 'compose'} title="Nachricht vorbereiten" busy={action.busy} onClose={() => setSheet(undefined)}>
        {action.error ? <ErrorState message={action.error} /> : null}
        <AppText variant="fieldLabel">Klassenstufe</AppText>
        <Segmented label="Klassenstufe" options={grades.map((item) => ({ id: item, label: item, disabled: action.busy }))} value={grade} onChange={setGrade} />
        <Button title="Foto wählen" variant="secondary" disabled={action.busy} onPress={choosePhoto} />
        <Button title="PDF wählen" variant="secondary" disabled={action.busy} onPress={choosePdf} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { maxWidth: '100%', paddingHorizontal: 0, paddingVertical: 0 },
  workspace: { flex: 1, flexDirection: 'row' },
  conversation: { flex: 1, minWidth: 0 },
  sidebar: { width: 248, borderRightWidth: StyleSheet.hairlineWidth },
  history: { flex: 1, paddingHorizontal: spacing.md },
  historyHeader: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  historyList: { gap: spacing.xs, paddingBottom: spacing.lg },
  historyItem: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.field },
  chatHeader: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  chatTitle: { flex: 1 },
  messageScroll: { flex: 1, minHeight: 0 },
  messageContent: { flexGrow: 1, gap: spacing.xl, paddingVertical: spacing.xl },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.md },
  emptyTitle: { textAlign: 'center' },
  userMessage: { maxWidth: '94%', alignSelf: 'flex-end', padding: spacing.md, borderRadius: radius.field, gap: spacing.xs },
  reply: { alignSelf: 'stretch', gap: spacing.sm },
  typing: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  alignStart: { alignSelf: 'flex-start' },
  composer: { gap: spacing.sm, paddingTop: spacing.xs, paddingBottom: spacing.sm },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  inputGroup: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, borderRadius: radius.card, borderWidth: 1, padding: spacing.xs },
  input: { flex: 1, minHeight: 44, maxHeight: 120, paddingHorizontal: spacing.xs, paddingTop: 11, paddingBottom: 11 },
  attachment: { alignSelf: 'flex-start', maxWidth: '100%', flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.md, borderRadius: radius.pill },
  attachmentName: { flexShrink: 1 },
  iconButton: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  drawerFrame: { flex: 1 },
  drawerBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0, 0, 0, 0.36)' },
  drawer: { flex: 1, width: '86%', maxWidth: 330 },
});
