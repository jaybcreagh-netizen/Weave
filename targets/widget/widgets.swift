import WidgetKit
import SwiftUI

// App Group identifier - must match app and native module
private let APP_GROUP = "group.com.jaycreagh.WeaveNative.widget"
private let WIDGET_DATA_KEY = "todaysFocusData"

// Widget Focus Data structure matching TypeScript interface
struct WidgetFocusData: Codable {
    let state: String
    let title: String
    let subtitle: String
    let friendName: String?
    let daysInfo: String?
    let deepLink: String
    let timestamp: Double
}

// Timeline Provider
struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(
            date: Date(),
            focusData: WidgetFocusData(
                state: "quick-weave",
                title: "Stay Connected",
                subtitle: "Tap to log a weave",
                friendName: nil,
                daysInfo: nil,
                deepLink: "weavenative://weave-logger",
                timestamp: Date().timeIntervalSince1970
            )
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        let entry = SimpleEntry(date: Date(), focusData: loadFocusData())
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> ()) {
        let currentDate = Date()
        let focusData = loadFocusData()

        // Create entry
        let entry = SimpleEntry(date: currentDate, focusData: focusData)

        // Refresh timeline every 15 minutes
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: currentDate)!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))

        completion(timeline)
    }

    // Load focus data from shared UserDefaults
    private func loadFocusData() -> WidgetFocusData {
        guard let userDefaults = UserDefaults(suiteName: APP_GROUP),
              let data = userDefaults.data(forKey: WIDGET_DATA_KEY) else {
            // Return default data if none available
            return WidgetFocusData(
                state: "quick-weave",
                title: "Weave",
                subtitle: "Open app to see today's focus",
                friendName: nil,
                daysInfo: nil,
                deepLink: "weavenative://",
                timestamp: Date().timeIntervalSince1970
            )
        }

        do {
            let focusData = try JSONDecoder().decode(WidgetFocusData.self, from: data)
            return focusData
        } catch {
            print("[Widget] Error decoding focus data: \(error)")
            return WidgetFocusData(
                state: "quick-weave",
                title: "Weave",
                subtitle: "Open app to see today's focus",
                friendName: nil,
                daysInfo: nil,
                deepLink: "weavenative://",
                timestamp: Date().timeIntervalSince1970
            )
        }
    }
}

// Timeline Entry
struct SimpleEntry: TimelineEntry {
    let date: Date
    let focusData: WidgetFocusData
}

// Widget Entry View
struct WidgetEntryView : View {
    @Environment(\.widgetFamily) var family
    var entry: Provider.Entry

    var body: some View {
        switch family {
        case .systemSmall:
            SmallWidgetView(entry: entry)
        case .systemMedium:
            MediumWidgetView(entry: entry)
        default:
            SmallWidgetView(entry: entry)
        }
    }
}

// Small Widget View (2x2)
struct SmallWidgetView: View {
    var entry: Provider.Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Icon based on state
            HStack {
                StateIcon(state: entry.focusData.state)
                    .font(.system(size: 16))
                Spacer()
                if let daysInfo = entry.focusData.daysInfo {
                    Text(daysInfo)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.white.opacity(0.9))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.white.opacity(0.2))
                        .cornerRadius(8)
                }
            }

            Spacer()

            // Friend name if available
            if let friendName = entry.focusData.friendName {
                Text(friendName)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(.white)
                    .lineLimit(1)
            }

            // Title
            Text(entry.focusData.title)
                .font(.system(size: 13, weight: .medium))
                .foregroundColor(.white.opacity(0.95))
                .lineLimit(2)
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(StateGradient(state: entry.focusData.state))
    }
}

// Medium Widget View (4x2)
struct MediumWidgetView: View {
    var entry: Provider.Entry

    var body: some View {
        HStack(spacing: 16) {
            // Left side - Icon and days
            VStack(alignment: .center, spacing: 4) {
                StateIcon(state: entry.focusData.state)
                    .font(.system(size: 32))
                    .foregroundColor(.white)

                if let daysInfo = entry.focusData.daysInfo {
                    Text(daysInfo)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.white.opacity(0.9))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Color.white.opacity(0.2))
                        .cornerRadius(8)
                }
            }
            .frame(width: 80)

            // Right side - Content
            VStack(alignment: .leading, spacing: 6) {
                if let friendName = entry.focusData.friendName {
                    Text(friendName)
                        .font(.system(size: 20, weight: .bold))
                        .foregroundColor(.white)
                        .lineLimit(1)
                }

                Text(entry.focusData.title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(.white.opacity(0.95))
                    .lineLimit(1)

                Text(entry.focusData.subtitle)
                    .font(.system(size: 13))
                    .foregroundColor(.white.opacity(0.8))
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(StateGradient(state: entry.focusData.state))
    }
}

// State-based icon
struct StateIcon: View {
    let state: String

    var body: some View {
        switch state {
        case "pressing-event":
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundColor(.white)
        case "todays-plan":
            Image(systemName: "calendar")
                .foregroundColor(.white)
        case "streak-risk":
            Image(systemName: "flame.fill")
                .foregroundColor(.white)
        case "friend-fading":
            Image(systemName: "heart.fill")
                .foregroundColor(.white)
        case "upcoming-plan":
            Image(systemName: "clock.fill")
                .foregroundColor(.white)
        case "quick-weave":
            Image(systemName: "sparkles")
                .foregroundColor(.white)
        case "all-clear":
            Image(systemName: "checkmark.circle.fill")
                .foregroundColor(.white)
        default:
            Image(systemName: "heart.fill")
                .foregroundColor(.white)
        }
    }
}

// State-based gradient background
struct StateGradient: View {
    let state: String

    var body: some View {
        switch state {
        case "pressing-event":
            // Red gradient for critical events
            LinearGradient(
                colors: [Color(red: 0.937, green: 0.267, blue: 0.267), Color(red: 0.737, green: 0.149, blue: 0.149)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case "todays-plan":
            // Purple gradient for today's plans
            LinearGradient(
                colors: [Color(red: 0.659, green: 0.333, blue: 0.969), Color(red: 0.502, green: 0.157, blue: 0.906)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case "streak-risk":
            // Purple gradient for streak
            LinearGradient(
                colors: [Color(red: 0.659, green: 0.333, blue: 0.969), Color(red: 0.502, green: 0.157, blue: 0.906)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case "friend-fading":
            // Orange gradient for fading friend
            LinearGradient(
                colors: [Color(red: 0.976, green: 0.451, blue: 0.086), Color(red: 0.855, green: 0.302, blue: 0.000)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case "upcoming-plan":
            // Cyan gradient for upcoming plans
            LinearGradient(
                colors: [Color(red: 0.024, green: 0.714, blue: 0.831), Color(red: 0.000, green: 0.545, blue: 0.647)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case "all-clear":
            // Green gradient for all clear
            LinearGradient(
                colors: [Color(red: 0.063, green: 0.725, blue: 0.506), Color(red: 0.000, green: 0.580, blue: 0.400)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        default:
            // Default purple/primary gradient
            LinearGradient(
                colors: [Color(red: 0.388, green: 0.424, blue: 0.945), Color(red: 0.290, green: 0.318, blue: 0.788)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }
}

// Widget Configuration
@main
struct TodaysFocusWidget: Widget {
    let kind: String = "widget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            WidgetEntryView(entry: entry)
                .widgetURL(URL(string: entry.focusData.deepLink))
        }
        .configurationDisplayName("Today's Focus")
        .description("See your most important relationship action for today")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// Preview
#Preview(as: .systemSmall) {
    TodaysFocusWidget()
} timeline: {
    SimpleEntry(
        date: .now,
        focusData: WidgetFocusData(
            state: "friend-fading",
            title: "Score dropping to 32",
            subtitle: "Plan something together",
            friendName: "Alex",
            daysInfo: "3d",
            deepLink: "weavenative://weave-logger",
            timestamp: Date().timeIntervalSince1970
        )
    )
    SimpleEntry(
        date: .now,
        focusData: WidgetFocusData(
            state: "pressing-event",
            title: "Birthday tomorrow!",
            subtitle: "Plan something special",
            friendName: "Sarah",
            daysInfo: "1d",
            deepLink: "weavenative://friend-profile",
            timestamp: Date().timeIntervalSince1970
        )
    )
}

#Preview(as: .systemMedium) {
    TodaysFocusWidget()
} timeline: {
    SimpleEntry(
        date: .now,
        focusData: WidgetFocusData(
            state: "streak-risk",
            title: "5-day streak at risk",
            subtitle: "A quick chat with Jamie could keep it going",
            friendName: "Jamie",
            daysInfo: nil,
            deepLink: "weavenative://weave-logger",
            timestamp: Date().timeIntervalSince1970
        )
    )
}
