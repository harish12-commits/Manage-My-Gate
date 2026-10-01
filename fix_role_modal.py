import re

with open('./mobile/mobile-app/src/features/roleBuilder/components/RoleFormSheetModal.tsx', 'r') as f:
    content = f.read()

# Remove the action buttons from inside the view
buttons_block = r"          \{\/\* Action Buttons \*\/}.*?<\/View>"
content = re.sub(buttons_block, "", content, flags=re.DOTALL)

# Now add them to the BottomSheet footer prop
footer_jsx = """      footer={
        <View className="flex-row gap-3 pt-1">
          <Button
            variant="outline"
            onPress={onClose}
            className="flex-1 h-12 rounded-xl border border-border bg-background"
            disabled={isSubmitting}
          >
            <Text className="text-sm font-bold text-foreground">Cancel</Text>
          </Button>
          <Button
            variant="default"
            onPress={handleSubmit}
            className="flex-1 h-12 rounded-xl bg-primary shadow-sm shadow-orange-500/20"
            disabled={isSubmitting}
            loading={isSubmitting}
          >
            <Text className="text-sm font-bold text-white">Save Changes</Text>
          </Button>
        </View>
      }"""

# Find the start of BottomSheet
bs_start = """    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={role ? `Edit ${role.name}` : 'New Security Role'}
    >"""

new_bs_start = f"""    <BottomSheet
      visible={{visible}}
      onClose={{onClose}}
      title={{role ? `Edit ${{role.name}}` : 'New Security Role'}}
{footer_jsx}
    >"""

content = content.replace(bs_start, new_bs_start)

with open('./mobile/mobile-app/src/features/roleBuilder/components/RoleFormSheetModal.tsx', 'w') as f:
    f.write(content)

