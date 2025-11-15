/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: "widget",
  icon: '../../../assets/icon.png',
  name: "Today's Focus",
  frameworks: ['SwiftUI', 'WidgetKit'],
  deploymentTarget: '16.0',
  entitlements: {
    "com.apple.security.application-groups": ["group.com.jaycreagh.WeaveNative.widget"]
  },
  colors: {
    $primary: { color: "#6366F1", darkColor: "#818CF8" },
    $amber: { color: "#F59E0B", darkColor: "#FCD34D" },
    $red: { color: "#EF4444", darkColor: "#F87171" },
    $orange: { color: "#F97316", darkColor: "#FB923C" },
    $cyan: { color: "#06B6D4", darkColor: "#22D3EE" },
    $purple: { color: "#A855F7", darkColor: "#C084FC" },
    $green: { color: "#10B981", darkColor: "#34D399" },
  }
});