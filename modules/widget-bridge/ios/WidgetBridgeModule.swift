import ExpoModulesCore
import WidgetKit

// App Group identifier for sharing data between app and widget
private let APP_GROUP = "group.com.jaycreagh.WeaveNative.widget"
private let WIDGET_DATA_KEY = "todaysFocusData"

public class WidgetBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WidgetBridgeModule")

    // Update widget with new focus data
    AsyncFunction("updateWidget") { (data: [String: Any]) in
      // Get shared UserDefaults
      guard let userDefaults = UserDefaults(suiteName: APP_GROUP) else {
        throw NSError(domain: "WidgetBridge", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to access shared UserDefaults"])
      }

      // Convert data to JSON and store
      do {
        let jsonData = try JSONSerialization.data(withJSONObject: data, options: [])
        userDefaults.set(jsonData, forKey: WIDGET_DATA_KEY)
        userDefaults.synchronize()

        // Trigger widget refresh
        if #available(iOS 14.0, *) {
          WidgetCenter.shared.reloadAllTimelines()
        }
      } catch {
        throw NSError(domain: "WidgetBridge", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to serialize widget data: \(error.localizedDescription)"])
      }
    }

    // Clear widget data
    AsyncFunction("clearWidget") {
      guard let userDefaults = UserDefaults(suiteName: APP_GROUP) else {
        throw NSError(domain: "WidgetBridge", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to access shared UserDefaults"])
      }

      userDefaults.removeObject(forKey: WIDGET_DATA_KEY)
      userDefaults.synchronize()

      // Trigger widget refresh
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
    }
  }
}
