import re

with open('./mobile/mobile-app/src/features/roleBuilder/components/RoleFormSheetModal.tsx', 'r') as f:
    content = f.read()

# Replace the layout
old_btns = r"\{\/\* Native Action CTAs \*\/}.*?<\/View>\s*<\/View>\s*<\/BottomSheet>"

footer_code = """        </View>
    </BottomSheet>"""

new_btns = r"""          </View>
        </View>
    </BottomSheet>"""

# Wait, let's just use string replacement carefully
# Let's extract the buttons block
btns_block = """          {/* Native Action CTAs */}
          <View className="flex-row flex-wrap items-center gap-3 mt-2 pt-3 border-t border-border">
            <Button variant="outline" onPress={onClose} className="flex-1 rounded-xl h-11">
              <Text className="font-bold text-xs text-foreground">Cancel</Text>
            </Button>
            <Button
              variant="default"
              loading={isSubmitting}
              onPress={handleSubmit}
              className="flex-1 min-w-[140px] rounded-xl h-11 bg-white border border-neutral-300"
            >
              <Text className="font-bold text-xs text-black">
                {role ? 'Save Changes' : 'Create Role'}
              </Text>
            </Button>
          </View>"""

# Replace it with nothing
if btns_block in content:
    content = content.replace(btns_block, "")
    
    # Now inject the footer prop into BottomSheet
    content = content.replace(
        "title={role ? 'Edit Role' : 'Create Custom Role'}",
        """title={role ? 'Edit Role' : 'Create Custom Role'}
        footer={
          <View className="flex-row flex-wrap items-center gap-3">
            <Button variant="outline" onPress={onClose} className="flex-1 rounded-xl h-12">
              <Text className="font-bold text-sm text-foreground">Cancel</Text>
            </Button>
            <Button
              variant="default"
              loading={isSubmitting}
              onPress={handleSubmit}
              className="flex-1 min-w-[140px] rounded-xl h-12 bg-white border border-neutral-300"
            >
              <Text className="font-bold text-sm text-black">
                {role ? 'Save Changes' : 'Create Role'}
              </Text>
            </Button>
          </View>
        }"""
    )
    
    with open('./mobile/mobile-app/src/features/roleBuilder/components/RoleFormSheetModal.tsx', 'w') as f:
        f.write(content)
else:
    print("Could not find btns_block")

