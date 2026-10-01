import React, { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, Modal, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, useWindowDimensions } from 'react-native';
import { X, Mail, Sparkles, CheckCircle2, AlertTriangle, Plus } from 'lucide-react-native';
import { TextInput } from '@/components/forms/TextInput';
import { DropdownSelect } from '@/components/forms/DropdownSelect';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/ui/text';
import apiClient from '../../../services/apiClient';

interface ConfigureInviteTemplateModalProps {
  visible: boolean;
  onClose: () => void;
}

const DEFAULT_INVITE_BODY = `Hello,

You have been invited to join our secure gated community management workspace.

Click the activation link below to set up your password and access account:
{{invite_link}}

Regards,
Community Operations Team`;

export const ConfigureInviteTemplateModal: React.FC<ConfigureInviteTemplateModalProps> = ({
  visible,
  onClose,
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isNarrowPhone = windowWidth < 390;
  const sheetHeight = Math.min(Math.round(windowHeight * 0.92), Platform.OS === 'web' ? 720 : windowHeight);
  const [connections, setConnections] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [name, setName] = useState('Standard User Invitation');
  const [type, setType] = useState<'email' | 'sms'>('email');
  const [subject, setSubject] = useState('Invitation to join Workspace');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [body, setBody] = useState(DEFAULT_INVITE_BODY);

  // Fetch connections & templates on open
  useEffect(() => {
    if (visible) {
      setErrorMsg('');
      setSuccessMsg('');
      setLoading(true);

      Promise.all([
        apiClient.get('/integrations/connections').catch(() => ({ data: [] })),
        apiClient.get('/templates?purpose=user_invitation').catch(() => ({ data: [] })),
      ])
        .then(([connRes, tmplRes]: any[]) => {
          const fetchedConns = connRes.data?.data || connRes.data || [];
          const fetchedTmpls = tmplRes.data?.data || tmplRes.data || [];
          setConnections(Array.isArray(fetchedConns) ? fetchedConns : []);
          setTemplates(Array.isArray(fetchedTmpls) ? fetchedTmpls : []);

          if (Array.isArray(fetchedTmpls) && fetchedTmpls.length > 0) {
            const match = fetchedTmpls.find((t: any) => t.purpose === 'user_invitation') || fetchedTmpls[0];
            setTemplateId(match._id || match.id);
            setName(match.name || 'Standard User Invitation');
            setType(match.type || 'email');
            setSubject(match.subject || 'Invitation to join Workspace');
            setCc(match.cc || '');
            setBcc(match.bcc || '');
            setBody(match.body || DEFAULT_INVITE_BODY);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [visible]);

  // Compute available channel options based on active integrations
  const availableTypes = useMemo(() => {
    const activeProviders = connections
      .filter((c: any) => c && c.provider)
      .map((c: any) => String(c.provider).toLowerCase());

    const channels = [];
    if (activeProviders.includes('smtp') || activeProviders.includes('resend') || activeProviders.length === 0) {
      channels.push({ label: '📧 Email Channel (SMTP/Resend)', value: 'email' });
    }
    if (activeProviders.includes('twilio')) {
      channels.push({ label: '💬 SMS Channel (Twilio)', value: 'sms' });
    }
    if (channels.length === 0) {
      channels.push({ label: '📧 Email Channel (Default)', value: 'email' });
    }
    return channels;
  }, [connections]);

  const handleInsertPlaceholder = () => {
    if (!body.includes('{{invite_link}}')) {
      setBody((prev) => `${prev.trim()}\n\n{{invite_link}}`);
    }
  };

  const handleSave = async () => {
    if (!body.includes('{{invite_link}}')) {
      setErrorMsg('Invitation templates MUST contain the placeholder {{invite_link}}');
      return;
    }

    if (!name.trim()) {
      setErrorMsg('Template label is required');
      return;
    }

    if (type === 'email' && !subject.trim()) {
      setErrorMsg('Email subject line is required');
      return;
    }

    setErrorMsg('');
    setSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        type,
        purpose: 'user_invitation',
        subject: type === 'email' ? subject.trim() : undefined,
        cc: type === 'email' ? cc.trim() : undefined,
        bcc: type === 'email' ? bcc.trim() : undefined,
        body: body.trim(),
      };

      if (templateId) {
        await apiClient.put(`/templates/${templateId}`, payload);
      } else {
        await apiClient.post('/templates', payload);
      }

      setSuccessMsg('Invitation email template saved successfully!');
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(typeof err === 'string' ? err : err?.message || 'Failed to save invitation template');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent statusBarTranslucent={true} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View className="flex-1 justify-end items-center bg-black/50">
          <Pressable className="absolute inset-0" onPress={onClose} />
          <View
            style={{ height: sheetHeight, width: '100%', maxWidth: 560 }}
            className="bg-card rounded-t-3xl px-4 pt-4 pb-3 sm:px-5 sm:pt-5 border-t sm:border border-border flex-col sm:rounded-3xl sm:mb-4"
          >
          {/* Header */}
          <View className="flex-row items-center justify-between pb-3 border-b border-border mb-3">
            <View className="flex-row items-center flex-1 min-w-0 pe-2">
              <Mail size={20} color="#6366f1" className="me-2" />
              <View className="flex-1 min-w-0">
                <Text className="text-lg font-bold text-foreground text-start" numberOfLines={1}>Configure Invitation Mail</Text>
                <Text className="text-[11px] text-muted-foreground text-start" numberOfLines={2}>Customize invitation email & SMS template</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} className="p-1 rounded-full bg-muted">
              <X size={18} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {errorMsg ? (
            <View className="p-3 mb-3 bg-destructive/10 border border-destructive/20 rounded-xl flex-row items-start">
              <AlertTriangle size={16} color="#ef4444" className="me-2 mt-0.5" />
              <Text className="text-xs text-destructive font-semibold flex-1 text-start">{errorMsg}</Text>
            </View>
          ) : null}

          {successMsg ? (
            <View className="p-3 mb-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex-row items-center">
              <CheckCircle2 size={16} color="#10b981" className="me-2" />
              <Text className="text-xs text-emerald-600 font-semibold flex-1 text-start">{successMsg}</Text>
            </View>
          ) : null}

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1 }}
            className="flex-1"
          >
            {loading ? (
              <View className="py-8 items-center justify-center">
                <ActivityIndicator size="small" color="#6366f1" />
                <Text className="text-xs text-muted-foreground mt-2">Loading template configuration...</Text>
              </View>
            ) : (
              <View className="space-y-3">
                {/* Template Label */}
                <View className="mb-3">
                  <Text className="text-xs font-bold text-foreground text-start mb-1">
                    Template Label *
                  </Text>
                  <TextInput
                    placeholder="e.g. Standard Org Welcome"
                    value={name}
                    onChangeText={setName}
                  />
                </View>

                {/* Channel Selector */}
                <View className="mb-3">
                  <Text className="text-xs font-bold text-foreground text-start mb-1">
                    Dispatch Channel (Integration Hub Derived)
                  </Text>
                  <DropdownSelect
                    options={availableTypes}
                    value={type}
                    onValueChange={(val: any) => setType(val)}
                  />
                </View>

                {/* Subject Line (Email Channel) */}
                {type === 'email' && (
                  <>
                    <View className="mb-3">
                      <Text className="text-xs font-bold text-foreground text-start mb-1">
                        Email Subject Line *
                      </Text>
                      <TextInput
                        placeholder="Invitation to join Workspace"
                        value={subject}
                        onChangeText={setSubject}
                      />
                    </View>

                    {/* CC / BCC fields */}
                    <View
                      style={{ flexDirection: isNarrowPhone ? 'column' : 'row' }}
                      className="gap-2 mb-3"
                    >
                      <View className="flex-1">
                        <Text className="text-xs font-bold text-foreground text-start mb-1">
                          CC (Optional)
                        </Text>
                        <TextInput
                          placeholder="admin@org.com"
                          value={cc}
                          onChangeText={setCc}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs font-bold text-foreground text-start mb-1">
                          BCC (Optional)
                        </Text>
                        <TextInput
                          placeholder="audit@org.com"
                          value={bcc}
                          onChangeText={setBcc}
                        />
                      </View>
                    </View>
                  </>
                )}

                {/* Template Body */}
                <View className="mb-3">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-xs font-bold text-foreground text-start">
                      Template Body Canvas *
                    </Text>
                    <TouchableOpacity
                      onPress={handleInsertPlaceholder}
                      className="px-2 py-1 rounded-lg bg-primary/10 border border-primary/20 flex-row items-center"
                    >
                      <Plus size={12} color="#6366f1" className="me-1" />
                      <Text className="text-[10px] font-bold text-primary">Insert {'{{invite_link}}'}</Text>
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    placeholder="Write your email body template..."
                    value={body}
                    onChangeText={setBody}
                    multiline
                    numberOfLines={8}
                    className="font-mono text-xs min-h-[140px]"
                  />

                  <View className="mt-2 p-2 rounded-xl bg-muted/40 border border-border/60 flex-row items-center justify-between">
                    <Text className="text-[11px] text-muted-foreground text-start">
                      Required token: <Text className="font-mono font-bold text-primary">{'{{invite_link}}'}</Text>
                    </Text>
                    {body.includes('{{invite_link}}') ? (
                      <View className="flex-row items-center">
                        <CheckCircle2 size={12} color="#10b981" className="me-1" />
                        <Text className="text-[10px] font-bold text-emerald-600">Present</Text>
                      </View>
                    ) : (
                      <View className="flex-row items-center">
                        <AlertTriangle size={12} color="#ef4444" className="me-1" />
                        <Text className="text-[10px] font-bold text-destructive">Missing Token</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View
            style={{ flexDirection: isNarrowPhone ? 'column-reverse' : 'row', alignItems: isNarrowPhone ? 'stretch' : 'center' }}
            className="justify-end gap-2 pt-3 border-t border-border mt-2"
          >
            <Button variant="outline" size="sm" onPress={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onPress={handleSave}
              loading={submitting}
              disabled={submitting || loading || !body.includes('{{invite_link}}')}
            >
              Save Template
            </Button>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>
  );
};

export default ConfigureInviteTemplateModal;
