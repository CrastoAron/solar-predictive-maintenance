import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum ThemeChoice { light, dark, system }

/// Persisted user preferences (notification toggles, theme choice).
/// The original React app kept these in component state only.
class SettingsService extends ChangeNotifier {
  SettingsService._();
  static final SettingsService instance = SettingsService._();

  bool criticalAlerts = true;
  bool maintenanceReminders = true;
  bool offlineSensors = true;
  ThemeChoice theme = ThemeChoice.dark;

  Future<void> load() async {
    try {
      final p = await SharedPreferences.getInstance();
      criticalAlerts = p.getBool('criticalAlerts') ?? true;
      maintenanceReminders = p.getBool('maintenanceReminders') ?? true;
      offlineSensors = p.getBool('offlineSensors') ?? true;
      theme = ThemeChoice.values.firstWhere(
        (t) => t.name == p.getString('theme'),
        orElse: () => ThemeChoice.dark,
      );
      notifyListeners();
    } catch (_) {}
  }

  Future<void> _save() async {
    try {
      final p = await SharedPreferences.getInstance();
      await p.setBool('criticalAlerts', criticalAlerts);
      await p.setBool('maintenanceReminders', maintenanceReminders);
      await p.setBool('offlineSensors', offlineSensors);
      await p.setString('theme', theme.name);
    } catch (_) {}
  }

  void setCriticalAlerts(bool v) {
    criticalAlerts = v;
    notifyListeners();
    _save();
  }

  void setMaintenanceReminders(bool v) {
    maintenanceReminders = v;
    notifyListeners();
    _save();
  }

  void setOfflineSensors(bool v) {
    offlineSensors = v;
    notifyListeners();
    _save();
  }

  void setTheme(ThemeChoice t) {
    theme = t;
    notifyListeners();
    _save();
  }
}
