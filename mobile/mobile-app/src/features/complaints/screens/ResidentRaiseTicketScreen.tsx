import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, ScrollView, Alert, TouchableOpacity, Platform, Image as RNImage } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { KeyboardAwareScrollView } from '@/components/layout/KeyboardAwareScrollView';
import { Card } from '@/components/common/Card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { TextInput } from '@/components/forms/TextInput';
import { DropdownSelect } from '@/components/forms/DropdownSelect';
import { DatePicker } from '@/components/common/DatePicker';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { Button } from '@/components/ui/button';
import {
  Camera,
  Image as ImageIcon,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  X
} from 'lucide-react-native';
import { useComplaints } from '../hooks/useComplaints';
import complaintService from '../services/complaintService';
import { useTranslation } from '@/src/utils/i18n';

interface PhotoAttachment {
  uri: string;
  name: string;
  type: string;
  file?: any;
}

const CATEGORY_OPTIONS = [
  { label: 'Plumbing & Water', value: 'Plumbing' },
  { label: 'Electrical & Lighting', value: 'Electrical' },
  { label: 'Carpentry & Woodwork', value: 'Carpentry' },
  { label: 'Elevator & Lifts', value: 'Elevators' },
  { label: 'Air Conditioning / HVAC', value: 'AC & HVAC' },
  { label: 'Security & Access Gate', value: 'Security' },
  { label: 'Housekeeping & Cleaning', value: 'Housekeeping' },
  { label: 'Parking & Vehicles', value: 'Parking' },
  { label: 'Amenities & Facilities', value: 'Amenities' },
  { label: 'Gardening & Landscaping', value: 'Landscaping' },
  { label: 'Others (Please Specify)', value: 'Others' },
];

const SUGGESTED_ISSUES_MAP: Record<string, string[]> = {
  Plumbing: [
    'Kitchen Tap Leakage',
    'Bathroom Tap Leakage',
    'Flush Tank Not Working',
    'Washbasin Pipe Blocked',
    'Kitchen Sink Blocked',
    'No Water Supply in Bathroom',
    'Low Water Pressure',
    'Pipe Burst in Utility',
  ],
  Electrical: [
    'Power Outage in Flat',
    'MCB Tripping Frequently',
    'Tube Light Replacement',
    'Fan Regulator Not Working',
    'Switch Board Sparking',
    'Socket Not Working',
    'Intercom Dead',
    'Door Bell Not Working',
  ],
  Carpentry: [
    'Main Door Handle Broken',
    'Cabinet Hinge Loose',
    'Window Latch Stuck',
    'Wooden Door Swollen',
    'Drawer Track Damaged',
  ],
  Elevators: [
    'Lift Stuck',
    'Lift Making Noise',
    'Lift Fan Not Working',
    'Lift Light Not Working',
    'Lift Buttons Unresponsive',
  ],
  'AC & HVAC': [
    'AC Water Leakage',
    'AC Cooling Low',
    'AC Making Loud Noise',
    'Remote Control Not Responding',
  ],
  Security: [
    'Guard Not Present at Gate',
    'Unattended Delivery Package',
    'Visitor Allowed Without Approval',
    'Main Gate Boom Barrier Broken',
  ],
  Housekeeping: [
    'Corridor Not Swept',
    'Garbage Not Collected',
    'Dustbin Smelling in Lobby',
    'Staircase Dirty',
    'Lift Not Cleaned',
  ],
  Parking: [
    'Someone Parked in My Slot',
    'Unknown Vehicle in Visitor Parking',
    'Car Wash Area Dirty',
    'Basement Light Not Working',
  ],
  Amenities: [
    'Gym AC Not Working',
    'Treadmill Belt Broken',
    'Swimming Pool Water Unclean',
    'Badminton Court Net Torn',
  ],
  Landscaping: [
    'Plants Drying in Garden',
    'Grass Needs Trimming',
    'Sprinkler Broken',
    'Mosquito Fogging Required',
  ],
};

export function ResidentRaiseTicketScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const { t, translateText } = useTranslation();
  const { createComplaint, error, clearErrors } = useComplaints();

  // Auto-populate resident location from Redux auth user profile
  const authUser = useSelector((state: any) => state.auth?.user);
  const defaultFlat = authUser?.villaNumber || authUser?.flat || '';
  const defaultBuilding = authUser?.villaBlock || authUser?.building || authUser?.block || '';
  const defaultName = authUser?.username || authUser?.name || authUser?.firstName || '';

  // 3-Step Guided Wizard Form State
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [category, setCategory] = useState<string>(
    params.category && typeof params.category === 'string' ? params.category : 'Plumbing'
  );

  useEffect(() => {
    if (params.category && typeof params.category === 'string') {
      setCategory(params.category);
    }
  }, [params.category]);

  const [customCategory, setCustomCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [preferredVisitDate, setPreferredVisitDate] = useState<Date | null>(null);
  const [preferredVisitTime, setPreferredVisitTime] = useState('Morning (09:00 AM - 12:00 PM)');
  const [attachments, setAttachments] = useState<PhotoAttachment[]>([]);

  // Web Live Camera Viewfinder State & Refs
  const [showCameraModal, setShowCameraModal] = useState(false);
  const videoRef = useRef<any>(null);
  const mediaStreamRef = useRef<any>(null);

  // Workflow State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<any>(null);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      stopWebCamera();
    };
  }, []);

  // Filter suggested issues by search term or category
  const activeSuggestedIssues = useMemo(() => {
    const issues = SUGGESTED_ISSUES_MAP[category] || [];
    if (!title.trim()) return issues;
    return issues.filter((i) => i.toLowerCase().includes(title.toLowerCase()));
  }, [category, title]);

  // Start Web Live Camera Stream
  const startWebCamera = async () => {
    try {
      setShowCameraModal(true);
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }
    } catch (err) {
      console.error('[WebCamera] Error starting live stream:', err);
      Alert.alert('Camera Error', 'Could not access web camera stream.');
      stopWebCamera();
    }
  };

  // Capture Photo from Live Web Camera
  const captureWebPhoto = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const newFile: PhotoAttachment = {
          uri: dataUrl,
          name: `live_camera_${Date.now()}.jpg`,
          type: 'image/jpeg',
        };
        setAttachments((prev) => [...prev, newFile]);
      }
    } catch (err) {
      console.error('[WebCamera] Error capturing frame:', err);
    } finally {
      stopWebCamera();
    }
  };

  // Stop Web Camera Stream
  const stopWebCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track: any) => track.stop());
      mediaStreamRef.current = null;
    }
    setShowCameraModal(false);
  };

  // Live Camera Photo Capture Handler (Web Browser & Mobile Phone Support)
  const handleTakePhoto = async () => {
    if (attachments.length >= 5) {
      Alert.alert('Limit Reached', 'Maximum 5 photos allowed.');
      return;
    }

    if (Platform.OS === 'web') {
      startWebCamera();
      return;
    }

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission Needed', 'Camera permission is required to capture live photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setAttachments((prev) => [
          ...prev,
          {
            uri: asset.uri,
            name: asset.fileName || `camera_photo_${Date.now()}.jpg`,
            type: asset.mimeType || 'image/jpeg',
          },
        ]);
      }
    } catch (err) {
      console.error('[Camera] Error capturing photo:', err);
      Alert.alert('Camera Error', 'Failed to open camera.');
    }
  };

  // Phone Gallery Image Picker Handler
  const handleChooseGallery = async () => {
    if (attachments.length >= 5) {
      Alert.alert('Limit Reached', 'Maximum 5 photos allowed.');
      return;
    }

    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.onchange = (e: any) => {
        const files = e.target.files;
        if (files && files.length > 0) {
          const remainingSlots = 5 - attachments.length;
          const filesToSelect = Math.min(files.length, remainingSlots);
          const newFiles: PhotoAttachment[] = [];
          for (let i = 0; i < filesToSelect; i++) {
            const file = files[i];
            newFiles.push({
              uri: URL.createObjectURL(file),
              name: file.name || `gallery_photo_${Date.now()}_${i}.jpg`,
              type: file.type || 'image/jpeg',
              file: file,
            });
          }
          setAttachments((prev) => [...prev, ...newFiles]);
        }
      };
      input.click();
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission Needed', 'Photo gallery permission is required to choose photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets) {
        const remainingSlots = 5 - attachments.length;
        const selectedAssets = result.assets.slice(0, remainingSlots);
        const newFiles = selectedAssets.map((asset) => ({
          uri: asset.uri,
          name: asset.fileName || `gallery_photo_${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
        }));
        setAttachments((prev) => [...prev, ...newFiles]);
      }
    } catch (err) {
      console.error('[Gallery] Error picking photo:', err);
      Alert.alert('Gallery Error', 'Failed to pick photos.');
    }
  };

  const handleRemovePhoto = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!title.trim()) {
        Alert.alert('Required Field', 'Please enter an Issue Title / Subject.');
        return;
      }
      if (category === 'Others' && !customCategory.trim()) {
        Alert.alert('Required Field', 'Please specify your custom category.');
        return;
      }
    }

    if (step < 3) {
      setStep((prev) => (prev + 1) as any);
    } else {
      handleSubmit(false);
    }
  };

  const handlePrevStep = () => {
    if (step > 1) {
      setStep((prev) => (prev - 1) as any);
    }
  };

  // Convert Base64/DataURL to Blob for web upload
  const dataURLtoFile = (dataurl: string, filename: string) => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  // Upload local attachment files before complaint payload submission
  const uploadPhotos = async (files: PhotoAttachment[]) => {
    if (!files || files.length === 0) return [];
    
    const existingUrls = files.filter(p => p.uri && (p.uri.startsWith('http') || p.uri.startsWith('/uploads'))).map(p => p.uri!);
    const localFiles = files.filter(p => p.uri && !p.uri.startsWith('http') && !p.uri.startsWith('/uploads'));

    if (localFiles.length === 0) return existingUrls;

    try {
      const formData = new FormData();
      localFiles.forEach((fileObj, index) => {
        if (fileObj.file) {
          formData.append('attachments', fileObj.file);
        } else if (fileObj.uri && fileObj.uri.startsWith('data:image')) {
          const file = dataURLtoFile(fileObj.uri, fileObj.name || `photo_${Date.now()}_${index}.jpg`);
          formData.append('attachments', file);
        } else {
          const fileUri = fileObj.uri;
          const fileName = fileObj.name || `photo_${Date.now()}_${index}.jpg`;
          const fileType = fileObj.type || 'image/jpeg';
          formData.append('attachments', {
            uri: fileUri,
            name: fileName,
            type: fileType,
          } as any);
        }
      });

      const uploadRes: any = await complaintService.uploadAttachments(formData);
      const uploadedUrls = uploadRes?.data || uploadRes || [];
      const newUrls = Array.isArray(uploadedUrls) ? uploadedUrls : [uploadedUrls];
      return [...existingUrls, ...newUrls];
    } catch (err) {
      console.error('[Upload] Attachment upload fallback:', err);
      return files.map(p => p.uri!).filter(Boolean);
    }
  };

  const handleSubmit = async (ignoreWarning = false) => {
    try {
      setIsSubmitting(true);
      const photoUrls = await uploadPhotos(attachments);
      const finalCategory = category === 'Others' ? customCategory.trim() : category;

      const payload = {
        category: finalCategory,
        department: finalCategory,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        isEmergency: priority === 'Critical',
        location: {
          flat: defaultFlat || undefined,
          building: defaultBuilding || undefined,
        },
        residentName: defaultName || undefined,
        preferredVisitDate: preferredVisitDate ? preferredVisitDate.toISOString() : undefined,
        preferredVisitTime,
        attachments: photoUrls,
        ignoreDuplicateWarning: ignoreWarning,
      };

      const res = await createComplaint(payload);
      setSubmittedTicket(
        res || {
          complaintNumber: 'TKT-' + Math.floor(100000 + Math.random() * 900000),
          status: 'Submitted',
          priority: payload.priority,
        }
      );
      setShowDuplicateWarning(false);
    } catch (err: any) {
      const msg = err?.message?.toLowerCase() || '';
      if (err?.status === 409 || msg.includes('duplicate') || msg.includes('similar')) {
        setShowDuplicateWarning(true);
      } else {
        console.error('Failed to raise ticket:', err);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmittedTicket(null);
    setShowDuplicateWarning(false);
    setStep(1);
    setCategory('Plumbing');
    setCustomCategory('');
    setTitle('');
    setDescription('');
    setAttachments([]);
    setPriority('Medium');
  };

  // TICKET SUBMITTED CONFIRMATION RECEIPT VIEW
  if (submittedTicket) {
    const slaLabel =
      submittedTicket.priority === 'Critical'
        ? t('sla_immediate_emergency', 'Immediate Response (Emergency SLA)')
        : submittedTicket.priority === 'High'
        ? t('sla_within_24h', 'Within 24 Hours (High SLA)')
        : t('sla_within_48h', 'Within 48 Hours (Standard SLA)');

    return (
      <ScreenShell title={t('ticket_submitted', 'Ticket Submitted')} subtitle={t('request_routed_maintenance', 'Request routed to maintenance')} iconName="CheckCircle2">
        <View className="flex-1 bg-background px-4 py-6 items-center justify-center">
          <View className="w-16 h-16 rounded-full bg-emerald-500/10 items-center justify-center mb-4">
            <Icon as={CheckCircle2} size={36} className="text-emerald-500" />
          </View>
          <Text className="text-2xl font-black text-foreground text-center mb-1">
            {t('ticket_submitted_success', 'Ticket Submitted!')}
          </Text>
          <Text className="text-xs text-muted-foreground text-center mb-4">
            {t('ticket_assigned_desc', 'Your request has been logged and assigned to the maintenance team.')}
          </Text>

          <View className="bg-primary/10 border border-primary/30 rounded-full px-4 py-1.5 mb-6">
            <Text className="text-xs font-black text-primary">
              {`${t('ticket_id', 'Ticket ID')}: #${submittedTicket.complaintNumber || 'TKT-10098'}`}
            </Text>
          </View>

          <Card className="w-full bg-card border border-border rounded-2xl p-4 gap-3 mb-6 shadow-xs">
            <View className="flex-row items-center justify-between pb-2.5 border-b border-border/40">
              <Text className="text-xs text-muted-foreground font-medium">{t('category', 'Category')}</Text>
              <Text className="text-xs font-bold text-foreground">{translateText(category === 'Others' ? customCategory : category)}</Text>
            </View>

            <View className="flex-row items-center justify-between pb-2.5 border-b border-border/40">
              <Text className="text-xs text-muted-foreground font-medium">{t('priority_level', 'Priority Level')}</Text>
              <StatusBadge
                label={submittedTicket.priority || priority}
                variant={priority === 'Critical' ? 'danger' : priority === 'High' ? 'warning' : 'info'}
              />
            </View>

            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-muted-foreground font-medium">{t('expected_sla', 'Expected SLA')}</Text>
              <Text className="text-xs font-extrabold text-amber-600 dark:text-amber-400">{slaLabel}</Text>
            </View>
          </Card>

          <View className="w-full gap-3">
            <Button
              variant="default"
              size="lg"
              onPress={() => router.replace('/(resident)/complaints/my-tickets' as any)}
            >
              {t('track_request_status', 'Track Request Status')}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onPress={resetForm}
            >
              {t('raise_another_ticket', 'Raise Another Ticket')}
            </Button>
          </View>
        </View>
      </ScreenShell>
    );
  }

  const stepTitles = {
    1: t('issue_category_details', 'Issue Category & Details'),
    2: t('evidence_visit_schedule', 'Evidence & Visit Schedule'),
    3: t('urgency_review_summary', 'Urgency & Review Summary'),
  };

  return (
    <ScreenShell
      title={t('raise_maintenance_ticket', 'Raise Maintenance Ticket')}
      subtitle={t('raise_maintenance_ticket_subtitle', 'Report plumbing, electrical, carpentry or common area issues')}
      iconName="PlusCircle"
    >
      <View className="flex-1 bg-background">
        {/* TOP SUB-HEADER BAR WITH ALIGNED BACK, BADGE & CLOSE */}
        <View className="flex-row items-center justify-between px-4 py-3 bg-card border-b border-border/60">
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={step > 1 ? handlePrevStep : () => router.back()}
            className="w-9 h-9 rounded-full bg-muted/60 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel={t('go_back', 'Go back')}
          >
            <Icon as={ArrowLeft} size={18} className="text-foreground" />
          </TouchableOpacity>

          <View className="bg-primary/10 px-3.5 py-1.5 rounded-full border border-primary/20">
            <Text className="text-xs font-bold text-primary">{t('maintenance_ticket', 'Maintenance Ticket')}</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.back()}
            className="w-9 h-9 rounded-full bg-muted/60 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel={t('close', 'Close')}
          >
            <Icon as={X} size={18} className="text-foreground" />
          </TouchableOpacity>
        </View>

        {/* 3-STEP PROGRESS BAR (WITHOUT PERCENTAGE TEXT) */}
        <View className="px-4 pt-3 pb-3 bg-card border-b border-border/60">
          <View className="mb-2">
            <Text className="text-xs font-black text-foreground">
              {`${t('step', 'Step')} ${step} ${t('of', 'of')} 3: ${stepTitles[step]}`}
            </Text>
          </View>

          {/* 3 Segmented Progress Line Bars */}
          <View className="flex-row gap-2 h-1.5 w-full">
            <View className={`flex-1 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-muted/70'}`} />
            <View className={`flex-1 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-muted/70'}`} />
            <View className={`flex-1 rounded-full ${step >= 3 ? 'bg-primary' : 'bg-muted/70'}`} />
          </View>
        </View>

        {/* MAIN FORM SCROLL AREA */}
        <KeyboardAwareScrollView
          extraScrollHeight={56}
          className="flex-1 px-4 py-4"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: 130 }}
        >
          {error ? (
            <View className="mb-3">
              <ErrorBanner message={error} onDismiss={clearErrors} />
            </View>
          ) : null}

          {/* STEP 1: ISSUE CATEGORY & SUBJECT */}
          {step === 1 && (
            <View className="bg-card border border-border rounded-2xl p-4 gap-4 shadow-xs">
              <View>
                <Text className="text-base font-black text-foreground">Issue Information</Text>
                <Text className="text-xs text-muted-foreground mt-0.5">Select category and describe your maintenance issue.</Text>
              </View>

              {/* 1. Category Dropdown */}
              <DropdownSelect
                label="Category *"
                value={category}
                options={CATEGORY_OPTIONS}
                onValueChange={(val) => setCategory(val)}
              />

              {/* Custom Category Input if 'Others' */}
              {category === 'Others' && (
                <TextInput
                  label="Specify Custom Category *"
                  placeholder="e.g. Pest Control, Roofing, Intercom"
                  value={customCategory}
                  onChangeText={setCustomCategory}
                />
              )}

              {/* 2. Issue Title / Subject */}
              <View>
                <TextInput
                  label="Issue Title / Subject *"
                  placeholder="e.g. Water leak under kitchen sink"
                  value={title}
                  onChangeText={setTitle}
                />

                {/* SUGGESTED ISSUE CHIPS BELOW INPUT */}
                {activeSuggestedIssues.length > 0 && (
                  <View className="mt-2 bg-muted/40 border border-border/60 rounded-xl p-3">
                    <View className="flex-row items-center mb-2">
                      <Icon as={Sparkles} size={13} className="text-amber-500 me-1.5" />
                      <Text className="text-[11px] font-bold text-muted-foreground uppercase">
                        Suggested Common Issues ({category})
                      </Text>
                    </View>
                    <View className="flex-row flex-wrap gap-1.5">
                      {activeSuggestedIssues.map((issue) => (
                        <TouchableOpacity
                          key={issue}
                          activeOpacity={0.7}
                          onPress={() => setTitle(issue)}
                          className={`px-3 py-1.5 rounded-full border ${
                            title === issue
                              ? 'bg-primary border-primary'
                              : 'bg-card border-border active:bg-muted'
                          }`}
                        >
                          <Text
                            className={`text-[11px] font-semibold ${
                              title === issue ? 'text-primary-foreground font-bold' : 'text-foreground'
                            }`}
                          >
                            {issue}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              {/* 3. Detailed Description */}
              <TextInput
                label="Detailed Description"
                placeholder="Describe what happened, exact location, or specific instructions..."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
            </View>
          )}

          {/* STEP 2: EVIDENCE & VISIT SCHEDULE */}
          {step === 2 && (
            <View className="bg-card border border-border rounded-2xl p-4 gap-4 shadow-xs">
              <View>
                <Text className="text-base font-black text-foreground">Evidence & Preferred Schedule</Text>
                <Text className="text-xs text-muted-foreground mt-0.5">Attach photos and select your preferred visit time window.</Text>
              </View>

              {/* DUAL CAMERA & GALLERY ACTION BUTTONS */}
              <View>
                <Text className="text-xs font-bold text-muted-foreground uppercase mb-2">
                  ISSUE PHOTOS / EVIDENCE ({attachments.length}/5)
                </Text>

                <View className="flex-row gap-2.5 mb-3">
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleTakePhoto}
                    className="flex-1 bg-card border border-border rounded-xl p-3.5 items-center justify-center flex-row gap-2 active:bg-muted"
                  >
                    <Icon as={Camera} size={18} className="text-foreground" />
                    <Text className="text-xs font-bold text-foreground">Take Photo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleChooseGallery}
                    className="flex-1 bg-card border border-border rounded-xl p-3.5 items-center justify-center flex-row gap-2 active:bg-muted"
                  >
                    <Icon as={ImageIcon} size={18} className="text-foreground" />
                    <Text className="text-xs font-bold text-foreground">Choose Photo</Text>
                  </TouchableOpacity>
                </View>

                {/* ATTACHMENT PHOTO THUMBNAILS */}
                {attachments.length > 0 && (
                  <View className="flex-row flex-wrap gap-2">
                    {attachments.map((item, index) => (
                      <View key={index} className="w-16 h-16 rounded-xl border border-border overflow-hidden relative bg-muted">
                        <RNImage source={{ uri: item.uri }} className="w-full h-full object-cover" />
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => handleRemovePhoto(index)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive items-center justify-center"
                        >
                          <Icon as={X} size={12} className="text-white" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Preferred Visit Scheduling */}
              <View className="gap-3.5 pt-2.5 border-t border-border/40">
                <DatePicker
                  label="Preferred Visit Date (Optional)"
                  value={preferredVisitDate}
                  onChange={(d) => setPreferredVisitDate(d)}
                />

                <DropdownSelect
                  label="Preferred Time Window"
                  value={preferredVisitTime}
                  options={[
                    { label: 'Morning (09:00 AM - 12:00 PM)', value: 'Morning (09:00 AM - 12:00 PM)' },
                    { label: 'Afternoon (12:00 PM - 04:00 PM)', value: 'Afternoon (12:00 PM - 04:00 PM)' },
                    { label: 'Evening (04:00 PM - 07:00 PM)', value: 'Evening (04:00 PM - 07:00 PM)' },
                  ]}
                  onValueChange={(val) => setPreferredVisitTime(val)}
                />
              </View>
            </View>
          )}

          {/* STEP 3: URGENCY & REVIEW SUMMARY */}
          {step === 3 && (
            <View className="gap-3.5">
              <View className="bg-card border border-border rounded-2xl p-4 gap-4 shadow-xs">
                <View>
                  <Text className="text-base font-black text-foreground">Set Urgency & Review</Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">Select priority level for SLA response timeline.</Text>
                </View>

                {/* Priority Selection Cards */}
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setPriority('Medium')}
                    className={`flex-1 border rounded-xl p-3 items-center justify-center ${
                      priority === 'Low' || priority === 'Medium'
                        ? 'bg-blue-500/10 border-blue-500'
                        : 'bg-card border-border opacity-70'
                    }`}
                  >
                    <Text className="font-extrabold text-xs text-blue-600 dark:text-blue-400">Standard</Text>
                    <Text className="text-[10px] text-muted-foreground mt-0.5">48h SLA</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setPriority('High')}
                    className={`flex-1 border rounded-xl p-3 items-center justify-center ${
                      priority === 'High'
                        ? 'bg-amber-500/10 border-amber-500'
                        : 'bg-card border-border opacity-70'
                    }`}
                  >
                    <Text className="font-extrabold text-xs text-amber-600 dark:text-amber-400">High</Text>
                    <Text className="text-[10px] text-muted-foreground mt-0.5">24h SLA</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setPriority('Critical')}
                    className={`flex-1 border rounded-xl p-3 items-center justify-center ${
                      priority === 'Critical'
                        ? 'bg-rose-500/10 border-rose-500'
                        : 'bg-card border-border opacity-70'
                    }`}
                  >
                    <Text className="font-extrabold text-xs text-rose-600 dark:text-rose-400">Critical</Text>
                    <Text className="text-[10px] text-muted-foreground mt-0.5">Immediate</Text>
                  </TouchableOpacity>
                </View>

                {/* Ticket Summary Review */}
                <View className="pt-2 border-t border-border/40 gap-2">
                  <Text className="text-xs font-bold text-muted-foreground uppercase mb-1">Ticket Summary Review</Text>
                  
                  <View className="bg-muted/30 border border-border/40 rounded-xl p-3.5 gap-2.5">
                    <View className="flex-row justify-between items-center">
                      <Text className="text-xs text-muted-foreground">Category:</Text>
                      <Text className="text-xs font-bold text-foreground">{category === 'Others' ? customCategory : category}</Text>
                    </View>
                    <View className="flex-row justify-between items-center">
                      <Text className="text-xs text-muted-foreground">Subject:</Text>
                      <Text className="text-xs font-bold text-foreground flex-1 text-right ms-2" numberOfLines={1}>{title}</Text>
                    </View>
                    <View className="flex-row justify-between items-center">
                      <Text className="text-xs text-muted-foreground">Attachments:</Text>
                      <Text className="text-xs font-bold text-foreground">{attachments.length} file(s)</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* DUPLICATE TICKET WARNING CARD */}
              {showDuplicateWarning && (
                <View className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 gap-2.5">
                  <View className="flex-row items-center">
                    <Icon as={AlertTriangle} size={18} className="text-amber-500 me-2" />
                    <Text className="font-extrabold text-xs text-amber-900 dark:text-amber-200">
                      Similar Issue Already Reported
                    </Text>
                  </View>
                  <Text className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                    An active ticket with a similar subject already exists for your unit. Would you still like to lodge this request?
                  </Text>
                  <View className="flex-row gap-2 mt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-card border-border"
                      onPress={() => router.push('/(resident)/complaints/my-tickets' as any)}
                    >
                      View Existing
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1 bg-amber-600 border-amber-600"
                      onPress={() => handleSubmit(true)}
                    >
                      Continue Anyway
                    </Button>
                  </View>
                </View>
              )}
            </View>
          )}
        </KeyboardAwareScrollView>

        {/* STICKY BOTTOM ACTION FOOTER */}
        <View className="absolute bottom-0 left-0 right-0 p-4 bg-card border-t border-border/60 flex-row items-center gap-3">
          {step > 1 ? (
            <Button
              variant="outline"
              size="lg"
              onPress={handlePrevStep}
              disabled={isSubmitting}
              className="w-28"
            >
              ← Back
            </Button>
          ) : null}

          <Button
            variant="default"
            size="lg"
            loading={isSubmitting}
            onPress={handleNextStep}
            className="flex-1"
          >
            {step === 3 ? (isSubmitting ? 'Submitting...' : 'Submit Ticket →') : 'Continue →'}
          </Button>
        </View>

        {/* LIVE WEB CAMERA VIEWFINDER MODAL */}
        {showCameraModal && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9999,
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 16,
            }}
          >
            <View
              style={{
                width: '100%',
                maxWidth: 480,
                backgroundColor: '#0f172a',
                borderRadius: 24,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: '#334155',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  backgroundColor: '#1e293b',
                  borderBottomWidth: 1,
                  borderBottomColor: '#334155',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon as={Camera} size={18} className="text-primary me-2" />
                  <Text className="text-sm font-bold text-white">Live Camera Photo Capture</Text>
                </View>
                <TouchableOpacity onPress={stopWebCamera} style={{ padding: 4 }}>
                  <Icon as={X} size={20} className="text-white" />
                </TouchableOpacity>
              </View>

              <View
                style={{
                  width: '100%',
                  height: 320,
                  backgroundColor: '#000',
                  justifyContent: 'center',
                  alignItems: 'center',
                  position: 'relative',
                }}
              >
                {Platform.OS === 'web' && (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
              </View>

              <View
                style={{
                  paddingVertical: 20,
                  backgroundColor: '#1e293b',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={captureWebPhoto}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: '#ffffff',
                    borderWidth: 4,
                    borderColor: '#94a3b8',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#000',
                    shadowOpacity: 0.3,
                    shadowRadius: 6,
                  }}
                >
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      borderWidth: 2,
                      borderColor: '#0f172a',
                    }}
                  />
                </TouchableOpacity>
                <Text className="text-[11px] font-semibold text-slate-400 mt-2">
                  Tap shutter to capture live photo
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </ScreenShell>
  );
}

export default ResidentRaiseTicketScreen;
