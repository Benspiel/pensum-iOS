import CoreGraphics
import ExpoModulesCore
import UIKit

private struct Answer: Record {
  @Field var box: [Double] = []
  @Field var text: String = ""
}

private enum DocumentError: LocalizedError {
  case invalidPDF, invalidImage, exportFailed

  var errorDescription: String? {
    switch self {
    case .invalidPDF: return "Das PDF oder die ausgewählte Seite konnte nicht geöffnet werden."
    case .invalidImage: return "Das Arbeitsblatt konnte nicht als Bild geöffnet werden."
    case .exportFailed: return "Die Datei konnte nicht exportiert werden."
    }
  }
}

public final class PensumDocumentsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PensumDocuments")

    AsyncFunction("pdfPageCount") { (uri: String) -> Int in
      try self.openPDF(uri).numberOfPages
    }

    AsyncFunction("renderPDFPage") { (uri: String, pageNumber: Int) -> [String: Any] in
      let document = try self.openPDF(uri)
      guard pageNumber > 0, pageNumber <= document.numberOfPages,
            let page = document.page(at: pageNumber) else { throw DocumentError.invalidPDF }
      let box = page.getBoxRect(.cropBox)
      let rotated = page.rotationAngle % 180 != 0
      let size = rotated ? CGSize(width: box.height, height: box.width) : box.size
      guard size.width > 0, size.height > 0, size.width.isFinite, size.height.isFinite else {
        throw DocumentError.invalidPDF
      }
      let longestEdge = max(size.width, size.height)
      let outputSize = CGSize(
        width: max(1, (size.width / longestEdge * 2300).rounded()),
        height: max(1, (size.height / longestEdge * 2300).rounded())
      )
      let rect = CGRect(origin: .zero, size: outputSize)
      let image = self.imageRenderer(outputSize).image { context in
        UIColor.white.setFill()
        context.fill(rect)
        let graphics = context.cgContext
        graphics.translateBy(x: 0, y: outputSize.height)
        graphics.scaleBy(x: 1, y: -1)
        graphics.concatenate(page.getDrawingTransform(.cropBox, rect: rect, rotate: 0, preserveAspectRatio: true))
        graphics.drawPDFPage(page)
      }
      guard let bytes = image.jpegData(compressionQuality: 0.93) else { throw DocumentError.exportFailed }
      let file = try self.save(bytes, suffix: "jpg")
      return ["uri": file.absoluteString, "width": Int(outputSize.width), "height": Int(outputSize.height)]
    }

    AsyncFunction("exportWorksheet") { (uri: String, answers: [Answer], handwritten: Bool, pdf: Bool) -> String in
      guard let file = URL(string: uri), file.isFileURL,
            let input = UIImage(contentsOfFile: file.path),
            input.size.width > 0, input.size.height > 0 else { throw DocumentError.invalidImage }
      let scale = min(1, 2600 / max(input.size.width, input.size.height))
      let size = CGSize(width: max(1, (input.size.width * scale).rounded()), height: max(1, (input.size.height * scale).rounded()))
      let bounds = CGRect(origin: .zero, size: size)
      let image = self.imageRenderer(size).image { context in
        UIColor.white.setFill()
        context.fill(bounds)
        input.draw(in: bounds)
        for answer in answers.prefix(80) {
          self.draw(answer, on: bounds, handwritten: handwritten, context: context.cgContext)
        }
      }
      if pdf {
        let scale = min(595 / size.width, 842 / size.height)
        let page = CGRect(x: 0, y: 0, width: size.width * scale, height: size.height * scale)
        let bytes = UIGraphicsPDFRenderer(bounds: page).pdfData { context in
          context.beginPage()
          image.draw(in: page)
        }
        return try self.save(bytes, suffix: "pdf").absoluteString
      }
      guard let bytes = image.pngData() else { throw DocumentError.exportFailed }
      return try self.save(bytes, suffix: "png").absoluteString
    }
  }

  private func openPDF(_ uri: String) throws -> CGPDFDocument {
    guard let url = URL(string: uri), url.isFileURL,
          let pdf = CGPDFDocument(url as CFURL), !pdf.isEncrypted || pdf.isUnlocked,
          pdf.numberOfPages > 0 else { throw DocumentError.invalidPDF }
    return pdf
  }

  private func save(_ bytes: Data, suffix: String) throws -> URL {
    let file = FileManager.default.temporaryDirectory
      .appendingPathComponent("Pensum-\(UUID().uuidString)")
      .appendingPathExtension(suffix)
    try bytes.write(to: file, options: [.atomic, .completeFileProtection])
    return file
  }

  private func imageRenderer(_ size: CGSize) -> UIGraphicsImageRenderer {
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    format.opaque = true
    return UIGraphicsImageRenderer(size: size, format: format)
  }

  private func draw(_ answer: Answer, on bounds: CGRect, handwritten: Bool, context: CGContext) {
    let points = answer.box
    guard points.count == 4, points.allSatisfy({ $0.isFinite && (0...1000).contains($0) }) else { return }
    let rect = CGRect(
      x: CGFloat(points[1]) / 1000 * bounds.width,
      y: CGFloat(points[0]) / 1000 * bounds.height,
      width: CGFloat(points[3] - points[1]) / 1000 * bounds.width,
      height: CGFloat(points[2] - points[0]) / 1000 * bounds.height
    ).insetBy(dx: 2, dy: 1)
    guard rect.width > 0, rect.height > 0 else { return }

    let paragraph = NSMutableParagraphStyle()
    paragraph.lineBreakMode = .byCharWrapping
    let text = String(answer.text.prefix(800)) as NSString
    var fontSize = max(4, min(rect.height * 0.82, min(bounds.width, bounds.height) * 0.033))
    var attributes: [NSAttributedString.Key: Any] = [:]
    let options: NSStringDrawingOptions = [.usesLineFragmentOrigin, .usesFontLeading]
    while true {
      let standard = UIFont.systemFont(ofSize: fontSize, weight: .medium)
      let font = handwritten ? UIFont(name: "BradleyHandITCTT-Bold", size: fontSize) ?? standard : standard
      attributes = [.font: font, .foregroundColor: UIColor(red: 0.12, green: 0.25, blue: 0.62, alpha: 1), .paragraphStyle: paragraph]
      let measured = text.boundingRect(with: CGSize(width: rect.width, height: .greatestFiniteMagnitude), options: options, attributes: attributes, context: nil)
      if measured.height <= rect.height || fontSize <= 4 { break }
      fontSize = max(4, fontSize - 0.5)
    }
    context.saveGState()
    context.clip(to: rect)
    text.draw(with: rect, options: options, attributes: attributes, context: nil)
    context.restoreGState()
  }
}
