import React, { useMemo } from 'react';
import { View } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/text';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Shield, User } from 'lucide-react-native';

/**
 * PollVotersModal Component (Pure JSX)
 * Displays the list of community members or units that voted on a poll.
 * If isAnonymous is true, personal identities are masked to preserve democratic privacy.
 */
export function PollVotersModal({
  visible,
  onClose,
  poll,
  voters = [],
  loading = false,
}) {
  if (!poll) return null;

  const isAnonymous = Boolean(poll.isAnonymous);

  const votersList = useMemo(() => {
    if (!voters) return [];
    if (Array.isArray(voters)) return voters;

    // Handle backend response format with anonymous summary: { isAnonymous: true, summary: [...] }
    if (voters.summary && Array.isArray(voters.summary)) {
      return voters.summary.map((item, idx) => ({
        _id: `summary-${idx}`,
        name: item.optionText || `Option ${idx + 1}`,
        unit: `${item.votesCount || 0} votes`,
        optionText: `${item.votesCount || 0} votes`,
        isSummary: true,
      }));
    }

    // Handle backend response format grouped by option index: { "0": [{ name, unit, votedAt }], "1": [...] }
    if (typeof voters === 'object') {
      const list = [];
      Object.keys(voters).forEach((key) => {
        const optionIndex = parseInt(key, 10);
        const optionText =
          !isNaN(optionIndex) && poll?.options?.[optionIndex]
            ? poll.options[optionIndex].text
            : undefined;

        const items = voters[key];
        if (Array.isArray(items)) {
          items.forEach((item, vIdx) => {
            if (typeof item === 'object' && item !== null) {
              list.push({
                ...item,
                _id: item._id || item.id || `voter-${key}-${vIdx}`,
                optionText: item.optionText || optionText,
              });
            }
          });
        }
      });
      return list;
    }

    return [];
  }, [voters, poll]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={isAnonymous ? 'Voter Turnout (Anonymous)' : 'Voter Turnout'}
    >
      <View className="py-2">
        {/* Privacy Notice Banner */}
        {isAnonymous && (
          <View className="flex-row items-center gap-2 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 mb-3">
            <Shield size={18} color="#6366f1" />
            <Text className="text-xs text-indigo-500 font-medium flex-1">
              This is an anonymous ballot. Personal identity details and individual ballot choices are concealed by cryptographic protocol.
            </Text>
          </View>
        )}

        {/* Loading Indicator */}
        {loading ? (
          <View className="py-8 items-center justify-center">
            <Text className="text-sm text-muted-foreground">Loading voter records...</Text>
          </View>
        ) : !votersList || votersList.length === 0 ? (
          <View className="py-8 items-center justify-center">
            <Text className="text-sm text-muted-foreground">No voter records recorded yet.</Text>
          </View>
        ) : (
          <View className="gap-2">
            {votersList.map((voter, index) => {
              const displayName = isAnonymous || voter?.isSummary
                ? voter?.name || `Voter #${index + 1}`
                : voter?.name || voter?.userName || voter?.residentName || 'Community Member';
              const unit = isAnonymous ? null : voter?.unitNumber || voter?.unit;
              const optionText = voter?.optionText;

              return (
                <View
                  key={voter?._id || index}
                  className="flex-row items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/50"
                >
                  <View className="flex-row items-center gap-2.5 flex-1 me-2">
                    <View className="w-8 h-8 rounded-full bg-muted items-center justify-center">
                      <User size={16} color="#64748b" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-foreground">
                        {displayName}
                      </Text>
                      {unit && (
                        <Text className="text-xs text-muted-foreground">
                          Unit: {unit}
                        </Text>
                      )}
                    </View>
                  </View>

                  {optionText && (
                    <StatusBadge
                      label={optionText}
                      variant="neutral"
                      size="sm"
                    />
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

export default PollVotersModal;
