import SwiftUI

extension Department {
    func localizedName(language: String = Locale.current.identifier) -> String {
        return LocalizationHelper.localizedDepartmentName(name)
    }
    
    var iconName: String {
        switch code {
        case "MS": return "camera.fill"          // Market -> Camera
        case "OP": return "film.fill"            // Operations -> Film
        case "RD": return "chevron.left.forwardslash.chevron.right" // R&D -> Code
        case "RE": return "shippingbox.fill"     // General -> Box
        default: return "building.2.fill"        // Default
        }
    }
}

struct LocalizationHelper {
    static func localizedDepartmentName(_ name: String) -> String {
        // 1. Try to extract Code from "Name (Code)"
        let pattern = "\\(([A-Z]{2,3})\\)$"
        if let regex = try? NSRegularExpression(pattern: pattern),
           let match = regex.firstMatch(in: name, range: NSRange(name.startIndex..., in: name)),
           let range = Range(match.range(at: 1), in: name) {
            
            let code = String(name[range])
            return localizedByCode(code) ?? name
        }
        
        // 2. Check if name itself is a Code (2-3 uppercase letters)
        let codePattern = "^[A-Z]{2,3}$"
        if let regex = try? NSRegularExpression(pattern: codePattern),
           regex.firstMatch(in: name, range: NSRange(name.startIndex..., in: name)) != nil {
            return localizedByCode(name) ?? name
        }
        
        // 3. Check for specific full English names (Map to Code -> Localize)
        let nameToCode: [String: String] = [
            "Marketing": "MS",
            "Operations": "OP",
            "R&D": "RD",
            "General Resource": "RE",
            "Human Resources": "HR", // Potential future proofing
            "Finance": "FI"
        ]
        
        if let code = nameToCode[name] {
             return localizedByCode(code) ?? name
        }
        
        // 4. Fallback: Try strictly localizing the name key itself (e.g. if we add "dept.Marketing" later)
        let key = "dept.\(name)"
        let localized = String(localized: String.LocalizationValue(key))
        if localized != key { return localized }
        
        return name
    }
    
    private static func localizedByCode(_ code: String) -> String? {
        let key = "dept.\(code)"
        
        // 1. Get saved language code or default to system/en
        var langCode = UserDefaults.standard.string(forKey: "longhorn_language")
        if langCode == nil {
            let systemLang = Locale.current.language.languageCode?.identifier ?? "en"
            if ["zh", "zh-Hans", "zh-Hant"].contains(systemLang) || systemLang.starts(with: "zh") {
                langCode = "zh-Hans"
            } else if ["de", "ja", "en"].contains(systemLang) {
                langCode = systemLang
            } else {
                langCode = "en"
            }
        }
        
        // 2. Handle mapping for "zh" if needed (xcstrings usually uses zh-Hans)
        if langCode == "zh" { langCode = "zh-Hans" }
        
        // 3. Load from specific bundle
        if let code = langCode,
           let path = Bundle.main.path(forResource: code, ofType: "lproj"),
           let bundle = Bundle(path: path) {
            let localized = NSLocalizedString(key, tableName: "Localizable", bundle: bundle, value: key, comment: "")
            if localized != key { return localized }
        }
        
        // 4. Fallback to standard lookup
        let localized = String(localized: String.LocalizationValue(key))
        if localized != key { return localized }
        
        return nil
    }
}

