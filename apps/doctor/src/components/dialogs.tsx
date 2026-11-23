import { useState } from 'react';
import { View } from 'react-native';
import { useApiMutation } from '@dyh/api';
import { initials } from '@dyh/core';
import { common, useT } from '@dyh/i18n';
import { Alert, Avatar, Button, Card, Dialog, Field, Icon, Input, Txt, toast } from '@dyh/ui-native';
import { useDoctorId, usePatient } from '../lib';
import { dm } from '../msgs';
import { useUi } from '../store';

export function AddendumDialog({ open, onClose, recordId }: { open: boolean; onClose: () => void; recordId: string }) {
  const t = useT(dm);
  const tc = useT(common);
  const [text, setText] = useState('');
  const save = useApiMutation((a, v: { id: string; text: string }) => a.addAddendum(v.id, v.text));
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('addAddendum')}
      icon="file-plus"
      actions={
        <>
          <Button variant="o" className="flex-1" onPress={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            variant="n"
            className="flex-1"
            icon="pen-tool"
            disabled={!text.trim()}
            loading={save.isPending}
            onPress={async () => {
              await save.mutateAsync({ id: recordId, text });
              setText('');
              onClose();
              toast.success(t('addendumSaved'));
            }}
          >
            Save & Sign
          </Button>
        </>
      }
    >
      <Input multiline value={text} onChangeText={setText} placeholder={t('addendumPh')} accessibilityLabel="Addendum" />
      <Txt size={12.5} className="mt-2 text-muted">
        {t('addendumNote')}
      </Txt>
    </Dialog>
  );
}

export function DelegateDialog({ open, onClose, pid }: { open: boolean; onClose: () => void; pid: string }) {
  const t = useT(dm);
  const tc = useT(common);
  const p = usePatient(pid);
  const me = useDoctorId();
  const [note, setNote] = useState('');
  const send = useApiMutation((a, v: { patientId: string; doctorId: string; note?: string }) => a.delegateToSecretary(v));
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('delegTitle')}
      icon="send"
      actions={
        <>
          <Button variant="o" className="flex-1" onPress={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            className="flex-1"
            icon="send"
            loading={send.isPending}
            onPress={async () => {
              await send.mutateAsync({ patientId: pid, doctorId: me, note });
              const s = useUi.getState();
              s.set({ delegated: [...s.delegated, pid] });
              setNote('');
              onClose();
              toast.success(t('delegSent'));
            }}
          >
            {t('send')}
          </Button>
        </>
      }
    >
      <Card className="flex-row items-center gap-3 p-3">
        <Avatar text={initials(p?.displayName ?? '')} size="sm" light />
        <View className="flex-1">
          <Txt w="b">{p?.displayName}</Txt>
          <Txt size={11} className="text-muted">
            {pid}
          </Txt>
        </View>
      </Card>
      <Field label={t('secretary')} icon="user">
        <Card className="flex-row items-center gap-2.5 p-3">
          <Icon name="clipboard-list" size={17} color="blue" />
          <Txt w="b" className="flex-1">
            Carla Ramos
          </Txt>
          <Icon name="lock" size={15} color="muted" />
        </Card>
      </Field>
      <Field label={t('noteSec')} icon="notebook-pen" optional hint={t('noteSecHint')}>
        <Input multiline value={note} onChangeText={setNote} placeholder={t('noteSecPh')} accessibilityLabel={t('noteSec')} />
      </Field>
      <Alert kind="info" icon="route" className="mt-3" text={t('delegFlow')} />
    </Dialog>
  );
}
