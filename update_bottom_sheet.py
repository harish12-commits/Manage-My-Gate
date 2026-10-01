import re

with open('./mobile/mobile-app/components/ui/BottomSheet.tsx', 'r') as f:
    content = f.read()

# Add footer prop
if "footer?: React.ReactNode;" not in content:
    content = content.replace(
        "children: React.ReactNode;",
        "children: React.ReactNode;\n  footer?: React.ReactNode;"
    )

    content = content.replace(
        "}: AppBottomSheetProps) {",
        "  footer,\n}: AppBottomSheetProps) {"
    )

# Add footer UI
if "{footer && (" not in content:
    content = content.replace(
        """          </KeyboardAwareScrollView>
        </View>
      </View>
    </Modal>""",
        """          </KeyboardAwareScrollView>
          {footer && (
            <View className="pb-8 pt-3 px-4 border-t border-border/80 bg-card">
              {footer}
            </View>
          )}
        </View>
      </View>
    </Modal>"""
    )

with open('./mobile/mobile-app/components/ui/BottomSheet.tsx', 'w') as f:
    f.write(content)
