import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Models } from 'react-native-appwrite';
import { executeFunction, functionIds, listAllRows, Query, tableIds } from '../../backend';
import { useAccountGuard } from '../appwrite-tools/account-scope';
import { AppText, Button, Card, EmptyState, ErrorState, Field, LoadingState, Screen } from '../../ui';
import { confirmAction, consentToGemini, errorText, useToolAction } from '../appwrite-tools/actions';
import { pickPhoto, prepareImage, removeTemporaryFile, type ImageSource } from '../appwrite-tools/images';
import { putHandoff } from '../shared/handoff';

type Chat = { id: string; title: string; updatedAt: string };
type ChatRow = Models.Row & { title: string };
type MessageRow = Models.Row & { role: 'user' | 'model'; text: string };
type Step = { id: string; label: string; detail: string; ms?: number };
type Message = { id: string; role: MessageRow['role']; text: string; steps?: Step[] };
type ChatReply = { chat: Chat; reply: { id: string; text: string }; steps?: Step[] };
type Attachment = { kind: 'image'; photo: ImageSource } | { kind: 'pdf'; uri: string; name: string };

const grades = [8, 9, 10, 11, 12];
const pdfBytesMax = 2_600_000;

function byUpdated(a: Chat, b: Chat) {
  return b.updatedAt.localeCompare(a.updatedAt);
}

export function KiChatScreen({ userId }: { userId: string }) {
  const router = useRouter();
  const action = useToolAction();
  const requireAccount = useAccountGuard();
  const [chats, setChats] = useState<Chat[]>([]);
  const [active, setActive] = useState<Chat | null>(null);
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachment, setAttachment] = useState<Attachment>();
  const [grade, setGrade] = useState(8);
  const [menu, setMenu] = useState(true);
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

  function open(chat: Chat) {
    void action.run(async () => {
      const rows = await listAllRows<MessageRow>(tableIds.chatMessages, [Query.equal('chatId', chat.id)], requireAccount);
      const history = rows
        .sort((a, b) => a.$createdAt.localeCompare(b.$createdAt) || (a.role === b.role ? 0 : a.role === 'user' ? -1 : 1))
        .map((row) => ({ id: row.$id, role: row.role, text: row.text }));
      setActive(chat);
      setChatTitle(chat.title);
      setMessages(history);
      setExpanded(null);
      setMenu(false);
      setText('');
      setAttachment(undefined);
    });
  }

  function newChat() {
    setActive(null);
    setChatTitle('');
    setMessages([]);
    setText('');
    setAttachment(undefined);
    setExpanded(null);
    setMenu(false);
    action.setError('');
  }

  function choosePhoto() {
    void action.run(async () => {
      const photo = await pickPhoto('library');
      if (photo) setAttachment({ kind: 'image', photo });
    });
  }

  function choosePdf() {
    void action.run(async () => {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
      const selected = result.assets?.[0];
      if (!selected) return;
      try {
        const size = selected.size ?? new File(selected.uri).size;
        if (!size || size > pdfBytesMax) throw new Error('Wähle ein PDF bis 2,6 MB.');
        setAttachment({ kind: 'pdf', uri: selected.uri, name: selected.name });
      } catch (reason) {
        removeTemporaryFile(selected.uri);
        throw reason;
      }
    });
  }

  function send() {
    const prompt = text.trim();
    if (!prompt && !attachment) return;
    void action.run(async () => {
      if (!await consentToGemini(attachment ? 'Deine Nachricht, der relevante Chatverlauf und der ausgewählte Anhang' : 'Deine Nachricht und der relevante Chatverlauf')) return;
      let image: string | undefined;
      if (attachment?.kind === 'image') image = (await prepareImage(attachment.photo)).base64;
      if (attachment?.kind === 'pdf') {
        image = await new File(attachment.uri).base64();
        if (image.length > 3_500_000) throw new Error('Das PDF ist zu groß.');
      }
      requireAccount();
      const result = await executeFunction<ChatReply>(functionIds.kiChat, {
        action: 'send', chatId: active?.id, text: prompt, grade, image,
      });
      setChats((list) => [result.chat, ...list.filter((chat) => chat.id !== result.chat.id)].sort(byUpdated));
      setActive(result.chat);
      setChatTitle(result.chat.title);
      setMessages((value) => [
        ...value,
        { id: `local-${result.reply.id}`, role: 'user', text: prompt || (attachment?.kind === 'pdf' ? 'PDF gesendet' : 'Foto gesendet') },
        { id: result.reply.id, role: 'model', text: result.reply.text, steps: result.steps },
      ]);
      setText('');
      setAttachment(undefined);
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
      setMenu(true);
    });
  }

  return (
    <Screen title="KI-Chat">
      <View style={styles.actions}>
        <Button title={menu ? 'Chatliste ausblenden' : 'Chatliste öffnen'} variant="secondary" disabled={action.busy} onPress={() => setMenu(!menu)} />
        <Button title="Neuer Chat" variant="secondary" disabled={action.busy} onPress={newChat} />
      </View>
      {action.error !== '' && <ErrorState message={action.error} />}
      {menu && (
        <Card>
          <AppText variant="section">Deine Chats</AppText>
          {listLoading && <LoadingState title="Chats werden geladen" />}
          {listError !== '' && <ErrorState message={listError} onRetry={() => setListAttempt((value) => value + 1)} />}
          {!listLoading && !listError && !chats.length && <EmptyState title="Noch keine Chats" />}
          {chats.map((chat) => <Button key={chat.id} title={chat.title || 'Chat'} variant="secondary" onPress={() => open(chat)} disabled={action.busy} />)}
        </Card>
      )}
      {active && (
        <Card>
          <Field label="Chatname" value={chatTitle} onChangeText={setChatTitle} maxLength={60} editable={!action.busy} />
          <View style={styles.actions}>
            <Button title="Umbenennen" variant="secondary" disabled={action.busy || !chatTitle.trim() || chatTitle.trim() === active.title} onPress={rename} />
            <Button title="Chat löschen" variant="danger" disabled={action.busy} onPress={remove} />
          </View>
        </Card>
      )}
      {messages.map((message) => {
        const solution = /\x60{3}lösung\s*\n([\s\S]*?)\x60{3}/i.exec(message.text)?.[1]?.trim();
        return (
          <Card key={message.id}>
            <AppText variant="label" tone={message.role === 'user' ? 'default' : 'accent'}>{message.role === 'user' ? 'Du' : 'Gemini'}</AppText>
            <AppText selectable>{message.text.replace(/\x60{3}[^\n]*\n|\x60{3}/g, '')}</AppText>
            {solution && (
              <View style={styles.actions}>
                <Button title="Lösung kopieren" variant="plain" disabled={action.busy} onPress={() => void action.run(async () => { await Clipboard.setStringAsync(solution); })} />
                <Button title="In Goodnotes-Tool übernehmen" variant="plain" disabled={action.busy} onPress={() => { putHandoff(solution, 'KI-Chat'); router.push('/tools/goodnotes'); }} />
              </View>
            )}
            {message.steps && message.steps.length > 0 && (
              <>
                <Button title={expanded === message.id ? 'Schritte ausblenden' : `${message.steps.length} Schritte anzeigen`} variant="plain" onPress={() => setExpanded(expanded === message.id ? null : message.id)} />
                {expanded === message.id && message.steps.map((step) => <AppText tone="muted" key={step.id}>{step.label}{step.detail ? ` · ${step.detail}` : ''}</AppText>)}
              </>
            )}
          </Card>
        );
      })}
      <Card>
        <AppText variant="label">Klassenstufe</AppText>
        <View style={styles.actions}>
          {grades.map((item) => <Button key={item} title={`Klasse ${item}`} variant={item === grade ? 'primary' : 'secondary'} onPress={() => setGrade(item)} disabled={action.busy} />)}
        </View>
        <Field label="Nachricht" value={text} onChangeText={setText} maxLength={4000} multiline editable={!action.busy} />
        <View style={styles.actions}>
          <Button title="Foto wählen" variant="plain" disabled={action.busy} onPress={choosePhoto} />
          <Button title="PDF wählen" variant="plain" disabled={action.busy} onPress={choosePdf} />
          {attachment && <Button title="Anhang entfernen" variant="plain" disabled={action.busy} onPress={() => setAttachment(undefined)} />}
        </View>
        {attachment && <AppText tone="muted">{attachment.kind === 'pdf' ? attachment.name : 'Foto ausgewählt'}</AppText>}
        <Button title="Senden" loading={action.busy} disabled={!text.trim() && !attachment} onPress={send} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({ actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
