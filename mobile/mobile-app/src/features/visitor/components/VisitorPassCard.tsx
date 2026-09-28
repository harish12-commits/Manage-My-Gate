import React from 'react';
import { View } from 'react-native';
import { ListCard } from '@/components/ui/ListCard';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { StatusBadge, StatusVariant } from '@/components/ui/StatusBadge';
import { useTranslation } from '@/src/utils/i18n';
import { VisitorPass } from '../store/visitorPassSlice';
import { QrCode, Phone, Car } from 'lucide-react-native';

interface VisitorPassCardProps {
  pass: VisitorPass;
  onPress: (pass: VisitorPass) => void;
  onShowQR: (pass: VisitorPass) => void;
  villaBadge?: string;
  isInside?: boolean;
}

const mapPassStatusVariant = (status: string, isInside?: boolean): StatusVariant => {
  if (isInside) return 'success';
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'PENDING':
      return 'warning';
    case 'REVOKED':
      return 'danger';
    case 'EXPIRED':
      return 'neutral';
    default:
      return 'neutral';
  }
};

const getInitials = (name?: string): string => {
  if (!name || !name.trim()) return 'VP';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

export const VisitorPassCard: React.FC<VisitorPassCardProps> = ({
  pass,
  onPress,
  onShowQR,
  villaBadge,
  isInside,
}) => {
  const { t, translateText } = useTranslation();
  const visitorDetails = (pass as any).visitorDetails || (pass as any).rawPass?.visitorDetails || {};
  const visitorName = pass.visitorName || visitorDetails.name || t('guest_visitor', 'Guest Visitor');
  const phone = pass.phone || visitorDetails.phone || '';
  const vObj = (pass as any).villaId;
  const unitNum = vObj?.unitNumber || vObj?.villaNumber || (pass as any).villaNumber || (pass as any).villaName || (pass as any).villaId?.name || (pass as any).villaId?.number;
  const block = vObj?.blockOrBuilding || vObj?.block ? ` (${vObj.blockOrBuilding || vObj.block})` : '';
  const resolvedVilla = unitNum ? `${t('villa_label', 'Villa')} ${unitNum}${block}` : ((pass as any).passType === 'ADMIN_GUEST' || !vObj ? t('community_common_area', 'Community / Common Area') : '');
  const displayVilla = villaBadge || resolvedVilla;

  const subtitleParts = [];
  if (displayVilla) subtitleParts.push(displayVilla);
  if (phone) subtitleParts.push(`Ph: ${phone}`);
  else if (pass.purpose) subtitleParts.push(`${t('for_purpose', 'For:')} ${translateText(pass.purpose)}`);
  else subtitleParts.push(`${t('code_label', 'Code:')} ${pass.code || (typeof pass._id === 'string' ? pass._id.slice(-6) : 'PASS')}`);

  const subtitle = subtitleParts.join(' • ');

  const badgeLabel = isInside ? 'INSIDE' : pass.status;
  const badgeVariant = mapPassStatusVariant(pass.status, isInside);
  const initials = getInitials(visitorName);

  return (
    <ListCard
      title={visitorName}
      subtitle={subtitle}
      leftAvatarFallback={initials}
      status={{
        label: badgeLabel,
        variant: badgeVariant,
      }}
      onPress={() => onPress(pass)}
      rightContent={
        <Button
          variant="outline"
          size="sm"
          onPress={(e: any) => {
            e?.stopPropagation?.();
            onShowQR(pass);
          }}
          className="flex-row items-center gap-1.5 h-8 px-2.5 rounded-xl border-primary/25 bg-primary/5 shadow-2xs"
        >
          <QrCode size={13} color="#EA580C" />
          <Text className="text-[11.5px] font-bold text-primary">{t('pass_code', 'Pass Code')}</Text>
        </Button>
      }
    />
  );
};

export default VisitorPassCard;
