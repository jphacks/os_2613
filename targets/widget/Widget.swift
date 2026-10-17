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
  static let muted = Color(red: 0.420, green: 0.435, blue: 0.404)    // #6B6F67 補足（著者名など。読みやすいよう濃いめ）
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
    // 大きさを測る部品（GeometryReader）は使わず、緑の棒を左端基準で横に縮めて表す（描画を軽くするため）
    Capsule().fill(Palette.track)
      .overlay(alignment: .leading) {
        Capsule().fill(Palette.green)
          .scaleEffect(x: min(1, max(0.03, value / 100)), y: 1, anchor: .leading)
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
    let count = 9
    for i in 1..<count {
      let y = rect.minY + rect.height * CGFloat(i) / CGFloat(count)
      // 右端の間隔を中央へ20%寄せ、紙の束の奥行きを表す。
      let end = rect.midY + (y - rect.midY) * 0.80
      // 紙の左端から右端近く（帯の幅14）まではまっすぐ、そこから斜めに真ん中へ寄せる（紙の形と同じ帯の幅）
      path.move(to: CGPoint(x: rect.minX, y: y))
      path.addLine(to: CGPoint(x: rect.maxX - 14, y: y))
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
        PaperShape(band: 14, ratio: 0.80).fill(Palette.page)
        // ページの線：紙の左端から右端まで通す。文字と重なるので、ごく薄くする
        PageEdges().stroke(Palette.pageLine.opacity(0.45), lineWidth: 1)
      }
      .clipShape(PaperShape(band: 14, ratio: 0.80))
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

// 長い文章の省略：決めた行数を超えたら「…」で切り、最後の行の終わりを右へ向かって薄くする
struct FadingText: View {
  let text: String
  let size: CGFloat
  let lines: Int
  var body: some View {
    Text(text)
      .font(.system(size: size)).foregroundStyle(Palette.body).lineSpacing(2)
      .lineLimit(lines).truncationMode(.tail)
      .mask(alignment: .bottom) {
        // 最後の行だけ、右の4割で少しずつ透明にする（それより上の行はそのまま）
        VStack(spacing: 0) {
          Rectangle()
          LinearGradient(stops: [.init(color: .black, location: 0), .init(color: .black, location: 0.6), .init(color: .black.opacity(0.15), location: 1)],
                         startPoint: .leading, endPoint: .trailing)
            .frame(height: size * 1.45)
        }
      }
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
      FadingText(text: recap(book), size: 14, lines: 3)
      Spacer(minLength: 0)
      ProgressFooter(value: book.progress)
    }
    .padding(.top, 18).padding(.bottom, 16).padding(.leading, 30).padding(.trailing, 34)
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
        Text(parts.0).font(.system(size: 14.5)).foregroundStyle(Palette.body).lineSpacing(5).lineLimit(7)
        Spacer(minLength: 0)
      }
      .padding(.leading, 14).padding(.trailing, 12)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      VStack(alignment: .leading, spacing: 5) {
        Text(parts.1).font(.system(size: 14.5)).foregroundStyle(Palette.body).lineSpacing(5).lineLimit(9)
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

// しおりがまだ無いときに出す「今日のおすすめ」（青空文庫で読める、著作権の切れた作品）。日替わりで1冊。
// 星の評価は、のちに SNS の評価と連動させる。アプリが App Group のキー "recommendations" に
// 同じ形の配列を書いたらそちらを使い、無ければ下の仮の一覧を使う（仮の評価は目安の値）。
struct Recommendation: Codable {
  let title: String
  let author: String
  let blurb: String
  let rating: Double   // 星の数（0〜5）
  let reviews: Int     // 評価の件数
}

private let builtinRecommendations: [Recommendation] = [
  Recommendation(title: "走れメロス", author: "太宰 治", blurb: "友を人質に、三日で戻ると誓った男の全力疾走。", rating: 4.5, reviews: 0),
  Recommendation(title: "吾輩は猫である", author: "夏目 漱石", blurb: "名前のない猫が、人間たちの暮らしを見つめる。", rating: 4.0, reviews: 0),
  Recommendation(title: "坊っちゃん", author: "夏目 漱石", blurb: "無鉄砲な新米教師が、田舎の学校で大暴れ。", rating: 4.0, reviews: 0),
  Recommendation(title: "羅生門", author: "芥川 龍之介", blurb: "雨の夜、行き場を失った下人が下した決断。", rating: 4.5, reviews: 0),
  Recommendation(title: "注文の多い料理店", author: "宮沢 賢治", blurb: "山奥の洋食店。扉を開けるたびに増える注文。", rating: 4.5, reviews: 0),
  Recommendation(title: "蜘蛛の糸", author: "芥川 龍之介", blurb: "地獄に垂らされた一本の糸と、人の心。", rating: 4.0, reviews: 0),
]

private func todaysRecommendation() -> Recommendation {
  var list = builtinRecommendations
  if let data = UserDefaults(suiteName: groupId)?.data(forKey: "recommendations"),
     let saved = try? JSONDecoder().decode([Recommendation].self, from: data), !saved.isEmpty {
    list = saved
  }
  let day = Calendar.current.ordinality(of: .day, in: .era, for: Date()) ?? 0
  return list[day % list.count]
}

// 星の評価（★を5つ並べ、評価の分だけ塗る。半分の星にも対応）
struct Stars: View {
  let rating: Double
  let size: CGFloat
  var body: some View {
    HStack(spacing: 2) {
      ForEach(0..<5, id: \.self) { i in
        let fill = min(1, max(0, rating - Double(i)))
        Image(systemName: fill >= 1 ? "star.fill" : fill >= 0.5 ? "star.leadinghalf.filled" : "star")
          .font(.system(size: size)).foregroundStyle(Palette.green)
      }
      Text(String(format: "%.1f", rating)).font(.system(size: size)).foregroundStyle(Palette.body).padding(.leading, 3)
    }
  }
}

// しおりがまだ無いとき：今日のおすすめの本と、星の評価
struct NoBookView: View {
  let family: WidgetFamily
  var body: some View {
    let pick = todaysRecommendation()
    let small = family == .systemSmall
    // 小は題名・作者・星を大きめにし、星は著者のすぐ下に置いて、まとまりを見出しの下の上下中央に置く
    VStack(alignment: .leading, spacing: small ? 6 : 5) {
      Eyebrow(text: "今日のおすすめ")
      if small { Spacer(minLength: 0) }
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Text(pick.title).font(.system(size: small ? 18 : 17, weight: .semibold)).foregroundStyle(Palette.ink).lineLimit(small ? 2 : 1)
        if !small { Text(pick.author).font(.system(size: 12)).foregroundStyle(Palette.body).lineLimit(1) }
      }
      if small { Text(pick.author).font(.system(size: 13)).foregroundStyle(Palette.body).lineLimit(1) }
      if !small {
        FadingText(text: pick.blurb, size: 14, lines: 2)
      }
      if small {
        Stars(rating: pick.rating, size: 14).padding(.top, 12)
        Spacer(minLength: 0)
      } else {
        Spacer(minLength: 0)
        Stars(rating: pick.rating, size: 13)
      }
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
    // 大サイズは表示できない端末があったので、いったん外す（LargeView のコードは後で使えるよう残す）
    .supportedFamilies([.systemSmall, .systemMedium])
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
