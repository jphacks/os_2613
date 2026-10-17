import SwiftUI
import WidgetKit

// アプリが App Group に保存した「いま読んでいる本」を表示する。
// まだ何も保存されていないときは、アプリを開くよう案内する。
private let groupId = "group.jp.dopabooks.app"

struct ReadingEntry: TimelineEntry {
  let date: Date
  let title: String
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> ReadingEntry {
    ReadingEntry(date: Date(), title: "走れメロス")
  }

  func getSnapshot(in context: Context, completion: @escaping (ReadingEntry) -> Void) {
    completion(currentEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<ReadingEntry>) -> Void) {
    completion(Timeline(entries: [currentEntry()], policy: .never))
  }

  private func currentEntry() -> ReadingEntry {
    let title = UserDefaults(suiteName: groupId)?.string(forKey: "currentTitle") ?? ""
    return ReadingEntry(date: Date(), title: title)
  }
}

struct DopaBooksWidgetView: View {
  let entry: ReadingEntry

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text("ドパBOOKs")
        .font(.caption2)
        .foregroundStyle(.secondary)
      Text(entry.title.isEmpty ? "本を開いて読み始めよう" : entry.title)
        .font(.headline)
        .lineLimit(2)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .containerBackground(Color(red: 0.965, green: 0.949, blue: 0.914), for: .widget)
  }
}

struct DopaBooksWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "DopaBooksWidget", provider: Provider()) { entry in
      DopaBooksWidgetView(entry: entry)
    }
    .configurationDisplayName("読んでいる本")
    .description("いま読んでいる本を表示します。")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

@main
struct DopaBooksWidgetBundle: WidgetBundle {
  var body: some Widget {
    DopaBooksWidget()
  }
}
