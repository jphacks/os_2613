import SwiftUI
import WidgetKit

// ホーム画面のウィジェット「しおり」。
// アプリが App Group に保存した「しおりを挟んだ本」の一覧を読み、
// 前回までのまとめ（まだ無ければしおりの直前の文）を、本としおりをイメージした見た目で表示する。
// しおりを挟んだ本が何冊もあるときは、15分ごとに順番に切り替える。
// タップすると、その本の読書画面（dopabooks://book/本のID）を開く。

private let groupId = "group.jp.dopabooks.app"
private let rotateMinutes = 15

// MARK: - 色（アプリの配色と合わせる）

private enum Palette {
  static let paper = Color(red: 0.965, green: 0.949, blue: 0.914)    // #F6F2E9
  static let surface = Color(red: 1.0, green: 0.992, blue: 0.973)    // #FFFDF8
  static let ink = Color(red: 0.161, green: 0.180, blue: 0.161)      // #292E29
  static let muted = Color(red: 0.451, green: 0.467, blue: 0.431)    // #73776E
  static let accent = Color(red: 0.220, green: 0.380, blue: 0.286)   // #386149
  static let line = Color(red: 0.871, green: 0.875, blue: 0.831)     // #DEDFD4
  static let covers: [Color] = [
    Color(red: 0.239, green: 0.353, blue: 0.275),  // #3D5A46
    Color(red: 0.478, green: 0.231, blue: 0.204),  // #7A3B34
    Color(red: 0.184, green: 0.290, blue: 0.388),  // #2F4A63
    Color(red: 0.420, green: 0.322, blue: 0.188),  // #6B5230
    Color(red: 0.290, green: 0.227, blue: 0.361),  // #4A3A5C
    Color(red: 0.184, green: 0.357, blue: 0.357),  // #2F5B5B
  ]
}

// MARK: - データ

struct WidgetBook: Codable {
  let bookId: String
  let title: String
  let author: String
  let excerpt: String
  let summary: String
  let progress: Double
  let updatedAt: Double
}

struct BookmarkEntry: TimelineEntry {
  let date: Date
  let book: WidgetBook?
  let index: Int  // 何冊目を表示しているか
  let total: Int  // しおりを挟んだ本の冊数
}

private func loadBooks() -> [WidgetBook] {
  guard let data = UserDefaults(suiteName: groupId)?.data(forKey: "bookmarks") else { return [] }
  return (try? JSONDecoder().decode([WidgetBook].self, from: data)) ?? []
}

private let sample = WidgetBook(
  bookId: "", title: "走れメロス", author: "太宰 治",
  excerpt: "メロスは激怒した。必ず、かの邪智暴虐の王を除かなければならぬと決意した。",
  summary: "村の牧人メロスは、人を信じられない王に怒り、城へ乗り込む。妹の結婚式のため、友セリヌンティウスを人質にして三日の猶予をもらった。",
  progress: 32, updatedAt: 0)

// MARK: - タイムライン（本を順番に切り替える）

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> BookmarkEntry {
    BookmarkEntry(date: Date(), book: sample, index: 0, total: 1)
  }

  func getSnapshot(in context: Context, completion: @escaping (BookmarkEntry) -> Void) {
    let books = loadBooks()
    completion(BookmarkEntry(date: Date(), book: books.first ?? sample, index: 0, total: max(1, books.count)))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<BookmarkEntry>) -> Void) {
    let books = loadBooks()
    let now = Date()
    if books.isEmpty {
      completion(Timeline(entries: [BookmarkEntry(date: now, book: nil, index: 0, total: 0)], policy: .never))
      return
    }
    // 1冊ずつ15分おきに表示し、一巡したら作り直す
    let entries = books.enumerated().map { offset, book in
      BookmarkEntry(
        date: now.addingTimeInterval(Double(offset * rotateMinutes * 60)),
        book: book, index: offset, total: books.count)
    }
    completion(Timeline(entries: entries, policy: .atEnd))
  }
}

// MARK: - 部品

// しおりのリボン（下が V 字に切れた帯）
struct Ribbon: Shape {
  func path(in rect: CGRect) -> Path {
    var path = Path()
    path.move(to: CGPoint(x: rect.minX, y: rect.minY))
    path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
    path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
    path.addLine(to: CGPoint(x: rect.midX, y: rect.maxY - rect.width * 0.45))
    path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
    path.closeSubpath()
    return path
  }
}

// 縦書きの文字（1文字ずつ縦に並べる）
struct VerticalText: View {
  let text: String
  let size: CGFloat
  let limit: Int
  var body: some View {
    let chars = Array(text.prefix(limit))
    VStack(spacing: 0) {
      ForEach(Array(chars.enumerated()), id: \.offset) { _, char in
        Text(String(char)).font(.system(size: size, weight: .semibold, design: .serif))
      }
    }
  }
}

// 本の表紙（背の影と縦書きの題名）
struct Cover: View {
  let book: WidgetBook
  let width: CGFloat
  let titleSize: CGFloat
  var color: Color {
    let sum = book.bookId.unicodeScalars.reduce(0) { $0 + Int($1.value) }
    return Palette.covers[sum % Palette.covers.count]
  }
  var body: some View {
    ZStack(alignment: .topTrailing) {
      RoundedRectangle(cornerRadius: 4).fill(color)
      HStack(spacing: 0) {
        Rectangle().fill(Color.black.opacity(0.22)).frame(width: width * 0.08)
        Spacer(minLength: 0)
      }
      VerticalText(text: book.title, size: titleSize, limit: 7)
        .foregroundStyle(Palette.surface)
        .padding(.top, 8)
        .padding(.trailing, width * 0.18)
      // 表紙の上から垂れるしおり
      Ribbon().fill(Palette.accent).frame(width: width * 0.16, height: width * 0.55)
        .offset(x: -width * 0.02, y: -2)
        .shadow(color: .black.opacity(0.2), radius: 1, y: 1)
    }
    .frame(width: width, height: width * 1.45)
    .shadow(color: .black.opacity(0.18), radius: 3, x: 1, y: 2)
  }
}

// 見出し（しおりの印＋文字）
struct Eyebrow: View {
  let text: String
  var body: some View {
    HStack(spacing: 4) {
      Ribbon().fill(Palette.accent).frame(width: 7, height: 11)
      Text(text).font(.system(size: 10, weight: .bold)).foregroundStyle(Palette.accent).tracking(1)
    }
  }
}

// 何冊目かを示す点
struct Dots: View {
  let index: Int
  let total: Int
  var body: some View {
    HStack(spacing: 4) {
      ForEach(0..<min(total, 8), id: \.self) { i in
        Circle().fill(i == index ? Palette.accent : Palette.line).frame(width: 5, height: 5)
      }
    }
  }
}

// 読み進めた割合（しおりの位置）
struct ReadProgress: View {
  let value: Double
  var body: some View {
    GeometryReader { geo in
      ZStack(alignment: .leading) {
        Capsule().fill(Palette.line)
        Capsule().fill(Palette.accent).frame(width: geo.size.width * min(1, max(0, value / 100)))
      }
    }
    .frame(height: 4)
  }
}

private func recap(_ book: WidgetBook) -> String {
  book.summary.isEmpty ? "「\(book.excerpt)」" : book.summary
}

private func recapLabel(_ book: WidgetBook) -> String {
  book.summary.isEmpty ? "しおりの位置" : "前回までのあらすじ"
}

// MARK: - 大きさごとの見た目

// 小：表紙としおり、題名と読み進めた割合
struct SmallView: View {
  let entry: BookmarkEntry
  let book: WidgetBook
  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(alignment: .top, spacing: 8) {
        Cover(book: book, width: 46, titleSize: 9)
        VStack(alignment: .leading, spacing: 3) {
          Eyebrow(text: "しおり")
          Text(book.title).font(.system(size: 14, weight: .semibold, design: .serif)).foregroundStyle(Palette.ink).lineLimit(3)
          Text(book.author).font(.system(size: 10)).foregroundStyle(Palette.muted).lineLimit(1)
        }
      }
      Spacer(minLength: 0)
      ReadProgress(value: book.progress)
      HStack {
        Text("\(Int(book.progress))%").font(.system(size: 10)).foregroundStyle(Palette.muted)
        Spacer()
        Text("つづき ›").font(.system(size: 11, weight: .semibold)).foregroundStyle(Palette.accent)
      }
    }
  }
}

// 中：表紙＋前回までのあらすじ
struct MediumView: View {
  let entry: BookmarkEntry
  let book: WidgetBook
  var body: some View {
    HStack(alignment: .top, spacing: 14) {
      Cover(book: book, width: 70, titleSize: 12)
      VStack(alignment: .leading, spacing: 5) {
        HStack {
          Eyebrow(text: recapLabel(book))
          Spacer()
          if entry.total > 1 { Dots(index: entry.index, total: entry.total) }
        }
        Text(book.title).font(.system(size: 15, weight: .semibold, design: .serif)).foregroundStyle(Palette.ink).lineLimit(1)
        Text(recap(book)).font(.system(size: 12)).foregroundStyle(Palette.ink.opacity(0.85)).lineLimit(3).lineSpacing(2)
        Spacer(minLength: 0)
        HStack(spacing: 8) {
          ReadProgress(value: book.progress)
          Text("つづきを読む ›").font(.system(size: 11, weight: .semibold)).foregroundStyle(Palette.accent).fixedSize()
        }
      }
    }
  }
}

// 大：本のページのような紙面に、あらすじとしおりの位置
struct LargeView: View {
  let entry: BookmarkEntry
  let book: WidgetBook
  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(alignment: .top, spacing: 14) {
        Cover(book: book, width: 78, titleSize: 13)
        VStack(alignment: .leading, spacing: 4) {
          Eyebrow(text: "しおりを挟んだ本")
          Text(book.title).font(.system(size: 19, weight: .semibold, design: .serif)).foregroundStyle(Palette.ink).lineLimit(2)
          Text(book.author).font(.system(size: 12)).foregroundStyle(Palette.muted)
          Spacer(minLength: 0)
          HStack {
            ReadProgress(value: book.progress)
            Text("\(Int(book.progress))%").font(.system(size: 10)).foregroundStyle(Palette.muted)
          }
        }
      }
      .frame(height: 113)
      // 紙面
      VStack(alignment: .leading, spacing: 8) {
        Text("前回までのあらすじ").font(.system(size: 11, weight: .bold)).foregroundStyle(Palette.accent)
        Text(book.summary.isEmpty ? "まだまとめていません。アプリでしおりを開き「ここまでを振り返る」を押すと、ここに出ます。" : book.summary)
          .font(.system(size: 13, design: .serif)).foregroundStyle(Palette.ink).lineSpacing(3).lineLimit(6)
        Divider().overlay(Palette.line)
        Text("しおりの位置").font(.system(size: 11, weight: .bold)).foregroundStyle(Palette.accent)
        Text("「\(book.excerpt)」").font(.system(size: 12, design: .serif)).foregroundStyle(Palette.muted).lineLimit(2)
      }
      .padding(12)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      .background(RoundedRectangle(cornerRadius: 6).fill(Palette.surface))
      .overlay(RoundedRectangle(cornerRadius: 6).stroke(Palette.line))
      HStack {
        if entry.total > 1 { Dots(index: entry.index, total: entry.total) }
        Spacer()
        Text("タップしてつづきを読む ›").font(.system(size: 12, weight: .semibold)).foregroundStyle(Palette.accent)
      }
    }
  }
}

// しおりがまだ無いとき
struct NoBookView: View {
  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Eyebrow(text: "しおり")
      Text("本にしおりを挟むと、ここに前回までのあらすじが出ます")
        .font(.system(size: 13, design: .serif)).foregroundStyle(Palette.ink)
      Spacer(minLength: 0)
      Text("ドパBOOKs を開く ›").font(.system(size: 11, weight: .semibold)).foregroundStyle(Palette.accent)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

struct DopaBooksWidgetView: View {
  @Environment(\.widgetFamily) var family
  let entry: BookmarkEntry

  var body: some View {
    Group {
      if let book = entry.book {
        switch family {
        case .systemSmall: SmallView(entry: entry, book: book)
        case .systemLarge: LargeView(entry: entry, book: book)
        default: MediumView(entry: entry, book: book)
        }
      } else {
        NoBookView()
      }
    }
    .widgetURL(URL(string: entry.book.map { "dopabooks://book/\($0.bookId)" } ?? "dopabooks://"))
    .containerBackground(Palette.paper, for: .widget)
  }
}

struct DopaBooksWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "DopaBooksWidget", provider: Provider()) { entry in
      DopaBooksWidgetView(entry: entry)
    }
    .configurationDisplayName("しおり")
    .description("しおりを挟んだ本の、前回までのあらすじを表示します。")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}

@main
struct DopaBooksWidgetBundle: WidgetBundle {
  var body: some Widget {
    DopaBooksWidget()
  }
}
