import { useState } from 'react';
import { Linking } from 'react-native';
import { executeFunction, functionIds } from '../../backend';
import { AppText, Button, Card, EmptyState, ErrorState, Field, Screen } from '../../ui';
import { useToolAction } from '../appwrite-tools/actions';
import { useAccountGuard } from '../appwrite-tools/account-scope';

type Video = { id: string; title: string; channel: string; published: string };
const videoId = /^[A-Za-z0-9_-]{11}$/;

export function VideosScreen() {
  const [topic, setTopic] = useState('');
  const [videos, setVideos] = useState<Video[]>();
  const action = useToolAction();
  const requireAccount = useAccountGuard();

  function search() {
    const query = topic.trim().replace(/\s+/g, ' ');
    if (query.length < 2) return;
    void action.run(async () => {
      setVideos(undefined);
      requireAccount();
      const result = await executeFunction<{ results: Video[] }>(functionIds.lehrerSchmidt, { topic: query });
      setVideos(result.results.filter((video) => videoId.test(video.id)));
    });
  }

  return (
    <Screen title="Erklärvideos" description="Finde ein Video von Lehrer Schmidt zu deinem Thema.">
      <Card>
        <Field label="Thema" value={topic} onChangeText={setTopic} editable={!action.busy} maxLength={120} />
        <Button title="Video finden" haptic="send" onPress={search} disabled={topic.trim().length < 2} loading={action.busy} />
      </Card>
      {action.error !== '' && <ErrorState message={action.error} />}
      {videos?.length === 0 && <EmptyState title="Keine passenden Videos" message="Versuch einen anderen Suchbegriff." />}
      {videos?.map((video) => (
        <Card key={video.id}>
          <AppText variant="section">{video.title}</AppText>
          <AppText tone="muted">{[video.channel, video.published].filter(Boolean).join(' · ')}</AppText>
          <Button title="Auf YouTube ansehen" variant="secondary" disabled={action.busy} onPress={() => {
            void action.run(async () => { await Linking.openURL(`https://www.youtube.com/watch?v=${video.id}`); });
          }} />
        </Card>
      ))}
    </Screen>
  );
}
