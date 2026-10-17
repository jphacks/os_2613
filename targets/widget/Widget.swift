import SwiftUI
import WidgetKit

// ホーム画面のウィジェット「しおり」。
// アプリが App Group に保存した「しおりを挟んだ本」の一覧を読み、前回までのあらすじと進み具合を表示する。
//   小：しおりの印と、円で表した進み具合
//   中：ウィジェットいっぱいの「上から見た本」（左が表紙の背、残りがページ）
//   大：ウィジェットいっぱいの「開いた本」（左右に紙の重なり、あらすじは左ページから右ページへ続く）
// しおりを挟んだ本が何冊もあるときは、15分ごとに順番に切り替える。
// タップすると、その本のしおりの位置（dopabooks://book/本のID?mark=位置）を開く。

private let groupId = "group.jp.dopabooks.app"
private let rotateMinutes = 15

// MARK: - 色（アプリの配色を薄めにしたもの）

private enum Palette {
  static let paper = Color(red: 0.980, green: 0.973, blue: 0.953)    // #FAF8F3 背景
  static let page = Color(red: 1.0, green: 0.992, blue: 0.973)       // #FFFDF8 紙
  static let ink = Color(red: 0.161, green: 0.180, blue: 0.161)      // #292E29 文字
  static let body = Color(red: 0.239, green: 0.259, blue: 0.239)     // #3D423D 本文
  static let muted = Color(red: 0.549, green: 0.565, blue: 0.529)    // #8C9087 補足
  static let green = Color(red: 0.220, green: 0.380, blue: 0.286)    // #386149 本棚の緑（表紙・進み具合）
  static let label = Color(red: 0.220, green: 0.380, blue: 0.286)    // #386149 見出し
  static let track = Color(red: 0.902, green: 0.886, blue: 0.847)    // #E6E2D8 進み具合の地
  static let edge = Color(red: 0.886, green: 0.863, blue: 0.804)     // #E2DCCD 紙の縁
  static let sheet1 = Color(red: 0.953, green: 0.937, blue: 0.902)   // #F3EFE6 重なった紙（奥）
  static let sheet2 = Color(red: 0.969, green: 0.957, blue: 0.925)   // #F7F4EC 重なった紙（中）
  static let pageLine = Color(red: 0.910, green: 0.890, blue: 0.843) // #E8E3D7 ページの線
}

// MARK: - データ

struct WidgetBook: Codable {
  let bookId: String
  let title: String
  let author: String
  let excerpt: String
  let offset: Double?
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
  excerpt: "メロスは激怒した。必ず、かの邪智暴虐の王を除かなければならぬと決意した。", offset: nil,
  summary: "村の牧人メロスは、人を信じられない暴君ディオニスに激怒し、王を除こうと城へ乗り込んで捕らえられる。妹の結婚式を挙げるため、竹馬の友セリヌンティウスを人質に差し出し、三日のうちに戻ると約束した。",
  progress: 32, updatedAt: 0)

// あらすじ（まだ作っていなければ、しおりの直前の文）
private func recap(_ book: WidgetBook) -> String {
  book.summary.isEmpty ? "「\(book.excerpt)」" : book.summary
}

// 大の見開き用に、あらすじを真ん中あたりの「。」で左右のページに分ける
private func splitRecap(_ text: String) -> (String, String) {
  let chars = Array(text)
  guard chars.count > 60 else { return (text, "") }
  let middle = chars.count * 2 / 5
  var cut = middle
  for (i, c) in chars.enumerated() where c == "。" && i >= middle / 2 {
    cut = i + 1
    if i >= middle { break }
  }
  return (String(chars[..<cut]), String(chars[cut...]))
}

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
      // 書き出しは日替わりなので、日付が変わったら作り直す
      let tomorrow = Calendar.current.startOfDay(for: now.addingTimeInterval(86400))
      completion(Timeline(entries: [BookmarkEntry(date: now, book: nil, index: 0, total: 0)], policy: .after(tomorrow)))
      return
    }
    // 1冊ずつ15分おきに表示し、一巡したら作り直す
    let entries = books.enumerated().map { offset, book in
      BookmarkEntry(date: now.addingTimeInterval(Double(offset * rotateMinutes * 60)), book: book, index: offset, total: books.count)
    }
    completion(Timeline(entries: entries, policy: .atEnd))
  }
}

// MARK: - 部品

// しおりの形（下が V 字に切れた帯）
struct Ribbon: Shape {
  func path(in rect: CGRect) -> Path {
    var path = Path()
    path.move(to: CGPoint(x: rect.minX, y: rect.minY))
    path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
    path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
    path.addLine(to: CGPoint(x: rect.midX, y: rect.maxY - rect.width * 0.5))
    path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
    path.closeSubpath()
    return path
  }
}

// 見出し（小さなしおりの印＋文字）
struct Eyebrow: View {
  let text: String
  var body: some View {
    HStack(spacing: 4) {
      Ribbon().fill(Palette.green).frame(width: 7, height: 11)
      Text(text).font(.system(size: 11, weight: .semibold)).foregroundStyle(Palette.label)
    }
  }
}

// 棒の進み具合
struct ProgressBar: View {
  let value: Double
  var body: some View {
    GeometryReader { geo in
      ZStack(alignment: .leading) {
        Capsule().fill(Palette.track)
        Capsule().fill(Palette.green).frame(width: max(5, geo.size.width * min(1, max(0, value / 100))))
      }
    }
    .frame(height: 5)
  }
}

// 進み具合の行：棒 → 右下に「32%」と「つづきを読む ›」
struct ProgressFooter: View {
  let value: Double
  var body: some View {
    HStack(spacing: 8) {
      ProgressBar(value: value)
      Text("\(Int(value))%").font(.system(size: 12)).foregroundStyle(Palette.ink).fixedSize()
      Text("つづきを読む ›").font(.system(size: 11, weight: .semibold)).foregroundStyle(Palette.label).fixedSize()
    }
  }
}

// 紙の形：右端へ向かう上下の縁を中央へ寄せ、外側には緑の表紙を残す。
struct PaperShape: Shape {
  let band: CGFloat
  let ratio: CGFloat
  func path(in rect: CGRect) -> Path {
    let start = rect.maxX - band
    let topEnd = rect.midY + (rect.minY - rect.midY) * ratio
    let bottomEnd = rect.midY + (rect.maxY - rect.midY) * ratio
    let radius = min(CGFloat(5), rect.height / 2, max(0, start - rect.minX))
    var path = Path()
    path.move(to: CGPoint(x: rect.minX + radius, y: rect.minY))
    path.addLine(to: CGPoint(x: start, y: rect.minY))
    path.addLine(to: CGPoint(x: rect.maxX, y: topEnd))
    path.addLine(to: CGPoint(x: rect.maxX, y: bottomEnd))
    path.addLine(to: CGPoint(x: start, y: rect.maxY))
    path.addLine(to: CGPoint(x: rect.minX + radius, y: rect.maxY))
    path.addQuadCurve(to: CGPoint(x: rect.minX, y: rect.maxY - radius), control: CGPoint(x: rect.minX, y: rect.maxY))
    path.addLine(to: CGPoint(x: rect.minX, y: rect.minY + radius))
    path.addQuadCurve(to: CGPoint(x: rect.minX + radius, y: rect.minY), control: CGPoint(x: rect.minX, y: rect.minY))
    path.closeSubpath()
    return path
  }
}
// ページの束の線：左端では等間隔、右へ行くほど上下へ広がる線（扇のように開いた紙の束）
struct PageEdges: Shape {
  func path(in rect: CGRect) -> Path {
    var path = Path()
    let count = 16
    for i in 1..<count {
      let y = rect.minY + rect.height * CGFloat(i) / CGFloat(count)
      // 右端の間隔を中央へ20%寄せ、紙の束の奥行きを表す。
      let end = rect.midY + (y - rect.midY) * 0.80
      path.move(to: CGPoint(x: rect.minX, y: y))
      path.addLine(to: CGPoint(x: rect.maxX, y: end))
    }
    return path
  }
}

// 中の背景：横に寝かせた本。左が緑の背表紙、上下は表紙の縁、右はページの束（細い縦線）
struct TopViewBackground: View {
  var body: some View {
    ZStack(alignment: .trailing) {
      Palette.green
      // 紙と線は同じ高さ・収束率を使う。上下の外側は背景の緑のまま残す。
      ZStack(alignment: .trailing) {
        PaperShape(band: 26, ratio: 0.80).fill(Palette.page)
        PageEdges().stroke(Palette.edge, lineWidth: 1)
          .frame(width: 26)
      }
      .clipShape(PaperShape(band: 26, ratio: 0.80))
      .padding(.leading, 18).padding(.vertical, 6)

    }
  }
}

// 大の背景：開いた本。左右のページの外側に紙を少しずつずらして重ね、真ん中にのどの線
struct PageStack: View {
  let outward: CGFloat // 紙をずらす向き（左ページは -1、右ページは +1）
  var body: some View {
    ZStack {
      RoundedRectangle(cornerRadius: 3).fill(Palette.sheet1).overlay(RoundedRectangle(cornerRadius: 3).stroke(Palette.edge, lineWidth: 1))
        .offset(x: outward * 8, y: 4)
      RoundedRectangle(cornerRadius: 3).fill(Palette.sheet2).overlay(RoundedRectangle(cornerRadius: 3).stroke(Palette.edge, lineWidth: 1))
        .offset(x: outward * 4, y: 2)
      RoundedRectangle(cornerRadius: 3).fill(Palette.page).overlay(RoundedRectangle(cornerRadius: 3).stroke(Palette.edge, lineWidth: 1))
    }
  }
}

struct OpenBookBackground: View {
  var body: some View {
    ZStack {
      Palette.green
      HStack(spacing: 0) {
        PageStack(outward: -1)
        Rectangle().fill(Palette.edge).frame(width: 1)
        PageStack(outward: 1)
      }
      .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 14)
    }
  }
}

// MARK: - 大きさごとの見た目

// 小：しおりの印と円の進み具合
struct SmallView: View {
  let book: WidgetBook
  var body: some View {
    VStack(spacing: 6) {
      HStack { Eyebrow(text: "しおり"); Spacer() }
      ZStack {
        Circle().stroke(Palette.track, lineWidth: 7)
        Circle().trim(from: 0, to: min(1, max(0.02, book.progress / 100)))
          .stroke(Palette.green, style: StrokeStyle(lineWidth: 7, lineCap: .round))
          .rotationEffect(.degrees(-90))
        Text("\(Int(book.progress))%").font(.system(size: 17, weight: .medium)).foregroundStyle(Palette.ink)
      }
      .frame(width: 76, height: 76)
      VStack(spacing: 1) {
        Text(book.title).font(.system(size: 13, weight: .semibold)).foregroundStyle(Palette.ink).lineLimit(1)
        Text(book.author).font(.system(size: 10)).foregroundStyle(Palette.muted).lineLimit(1)
      }
    }
    .padding(14)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Palette.paper)
  }
}

// 中：上から見た本の上に、題名・あらすじ・進み具合
struct MediumView: View {
  let book: WidgetBook
  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      Eyebrow(text: "しおり")
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Text(book.title).font(.system(size: 15, weight: .semibold)).foregroundStyle(Palette.ink).lineLimit(1)
        Text(book.author).font(.system(size: 11)).foregroundStyle(Palette.muted).lineLimit(1)
      }
      Text(recap(book)).font(.system(size: 14)).foregroundStyle(Palette.body).lineSpacing(2).lineLimit(3)
      Spacer(minLength: 0)
      ProgressFooter(value: book.progress)
    }
    .padding(.top, 18).padding(.bottom, 16).padding(.leading, 30).padding(.trailing, 32)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(TopViewBackground())
  }
}

// 大：開いた本。左ページに題名・作者とあらすじの前半、右ページにあらすじの続きと進み具合
// （大きさを測る部品を使わず、左右のページを同じ幅で並べるだけの単純な作りにする）
struct LargeView: View {
  let book: WidgetBook
  var body: some View {
    let parts = splitRecap(recap(book))
    HStack(alignment: .top, spacing: 0) {
      VStack(alignment: .leading, spacing: 5) {
        Eyebrow(text: "しおり")
        Text(book.title).font(.system(size: 18, weight: .semibold)).foregroundStyle(Palette.ink).lineLimit(2)
        Text(book.author).font(.system(size: 11)).foregroundStyle(Palette.muted).lineLimit(1)
        Text(book.summary.isEmpty ? "しおりの位置" : "前回までのあらすじ")
          .font(.system(size: 11, weight: .semibold)).foregroundStyle(Palette.label).padding(.top, 8)
        Text(parts.0).font(.system(size: 14.5)).foregroundStyle(Palette.body).lineSpacing(5)
        Spacer(minLength: 0)
      }
      .padding(.leading, 14).padding(.trailing, 12)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      VStack(alignment: .leading, spacing: 5) {
        Text(parts.1).font(.system(size: 14.5)).foregroundStyle(Palette.body).lineSpacing(5)
        Spacer(minLength: 0)
        ProgressBar(value: book.progress)
        HStack(spacing: 8) {
          Spacer(minLength: 0)
          Text("\(Int(book.progress))%").font(.system(size: 12)).foregroundStyle(Palette.ink)
          Text("つづきを読む ›").font(.system(size: 11, weight: .semibold)).foregroundStyle(Palette.label)
        }
      }
      .padding(.leading, 14).padding(.trailing, 14)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
    .padding(.horizontal, 16).padding(.top, 20).padding(.bottom, 24)
    .background(OpenBookBackground())
  }
}

// しおりがまだ無いときに出す「名作の書き出し」（青空文庫で読める、著作権の切れた作品）。日替わりで1つ。
private let openings: [(text: String, title: String, author: String)] = [
  ("メロスは激怒した。", "走れメロス", "太宰 治"),
  ("吾輩は猫である。名前はまだ無い。", "吾輩は猫である", "夏目 漱石"),
  ("親譲りの無鉄砲で小供の時から損ばかりしている。", "坊っちゃん", "夏目 漱石"),
  ("ある日の暮方の事である。一人の下人が、羅生門の下で雨やみを待っていた。", "羅生門", "芥川 龍之介"),
  ("恥の多い生涯を送って来ました。", "人間失格", "太宰 治"),
  ("山路を登りながら、こう考えた。", "草枕", "夏目 漱石"),
]

// しおりがまだ無いとき：名作の書き出しと、しおりの使い方の案内
struct NoBookView: View {
  let family: WidgetFamily
  var body: some View {
    let day = Calendar.current.ordinality(of: .day, in: .era, for: Date()) ?? 0
    let pick = openings[day % openings.count]
    let small = family == .systemSmall
    VStack(alignment: .leading, spacing: 6) {
      Eyebrow(text: "今日の書き出し")
      Text(pick.text)
        .font(.system(size: small ? 13 : 16, weight: .medium))
        .foregroundStyle(Palette.ink).lineSpacing(3).lineLimit(small ? 4 : 3)
      Text("— \(pick.author)『\(pick.title)』").font(.system(size: 10)).foregroundStyle(Palette.muted).lineLimit(1)
      Spacer(minLength: 0)
      if !small {
        Text("本にしおりを挟むと、ここに前回までのあらすじが出ます").font(.system(size: 11)).foregroundStyle(Palette.muted)
      }
      Text("本棚をひらく ›").font(.system(size: 11, weight: .semibold)).foregroundStyle(Palette.label)
    }
    .padding(.top, small ? 14 : 24).padding(.bottom, small ? 14 : 22)
    .padding(.leading, small ? 14 : family == .systemMedium ? 30 : 30).padding(.trailing, small ? 14 : 20)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(
      Group {
        if family == .systemMedium { TopViewBackground() }
        else if family == .systemLarge { OpenBookBackground() }
        else { Palette.paper }
      }
    )
  }
}

struct DopaBooksWidgetView: View {
  @Environment(\.widgetFamily) var family
  let entry: BookmarkEntry

  // 押したときに開く場所：しおりがあればその本のしおりの位置、無ければ本棚
  private var link: URL? {
    guard let book = entry.book, !book.bookId.isEmpty else { return URL(string: "dopabooks://") }
    let mark = book.offset.map { "?mark=\(Int($0))" } ?? ""
    return URL(string: "dopabooks://book/\(book.bookId)\(mark)")
  }

  var body: some View {
    Group {
      if let book = entry.book {
        switch family {
        case .systemSmall: SmallView(book: book)
        case .systemLarge: LargeView(book: book)
        default: MediumView(book: book)
        }
      } else {
        NoBookView(family: family)
      }
    }
    .widgetURL(link)
    .containerBackground(Palette.paper, for: .widget)
  }
}

struct DopaBooksWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "DopaBooksWidget", provider: Provider()) { entry in
      DopaBooksWidgetView(entry: entry)
    }
    .configurationDisplayName("しおり")
    .description("しおりを挟んだ本の、前回までのあらすじと進み具合を表示します。")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    // 本の絵をウィジェットの端まで描くため、標準の余白を外す（余白は各サイズの中で付ける）
    .contentMarginsDisabled()
  }
}

@main
struct DopaBooksWidgetBundle: WidgetBundle {
  var body: some Widget {
    DopaBooksWidget()
  }
}
