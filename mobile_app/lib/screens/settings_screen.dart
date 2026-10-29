import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../services/settings_service.dart';
import '../services/solar_data_service.dart';
import '../theme/app_colors.dart';
import '../widgets/app_badge.dart';
import '../widgets/app_card.dart';
import '../widgets/page_header.dart';
import '../widgets/screen_body.dart';

class SettingsScreen extends StatelessWidget {
  final VoidCallback onSignOut;
  SettingsScreen({super.key, required this.onSignOut});

  @override
  Widget build(BuildContext context) {
    final profile = SolarDataService.instance.profile;
    final settings = SettingsService.instance;
    final photoUrl = AuthService.instance.user?.photoURL;
    final initial = Text(profile.initial,
        style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18));

    return ListenableBuilder(
      listenable: settings,
      builder: (context, _) => ScreenBody(children: [
        PageHeader(title: 'Settings', subtitle: 'Account & preferences'),
        AppCard(
          shadow: false,
          padding: EdgeInsets.all(14),
          child: Row(children: [
            Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient:
                    LinearGradient(colors: [AppColors.blue, AppColors.cyan]),
              ),
              child: photoUrl == null || photoUrl.isEmpty
                  ? initial
                  : ClipOval(
                      child: Image.network(
                        photoUrl,
                        width: 44,
                        height: 44,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => initial,
                      ),
                    ),
            ),
            SizedBox(width: 11),
            Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(profile.fullName,
                        style: TextStyle(fontWeight: FontWeight.w700)),
                    SizedBox(height: 3),
                    Text(profile.note,
                        style: TextStyle(color: AppColors.muted, fontSize: 10)),
                  ]),
            ),
            AppBadge(
              AuthService.instance.user == null ? 'Signed out' : 'Firebase',
              tone: AuthService.instance.user == null
                  ? BadgeTone.info
                  : BadgeTone.good,
            ),
          ]),
        ),
        SizedBox(height: 22),
        SectionTitle('Appearance'),
        AppCard(
          shadow: false,
          padding: EdgeInsets.all(14),
          child: Row(children: [
            Icon(Icons.wb_sunny_outlined, size: 22),
            SizedBox(width: 11),
            Expanded(child: Text('Theme')),
            _Segmented(
              value: settings.theme,
              onChanged: settings.setTheme,
            ),
          ]),
        ),
        SizedBox(height: 22),
        SectionTitle('Notifications'),
        AppCard(
          shadow: false,
          padding: EdgeInsets.zero,
          child: Column(children: [
            _ToggleRow(
                icon: Icons.notifications_none_rounded,
                label: 'Critical alerts',
                value: settings.criticalAlerts,
                onChanged: settings.setCriticalAlerts),
            Divider(height: 1, color: AppColors.border),
            _ToggleRow(
                icon: Icons.calendar_today_outlined,
                label: 'Maintenance reminders',
                value: settings.maintenanceReminders,
                onChanged: settings.setMaintenanceReminders),
            Divider(height: 1, color: AppColors.border),
            _ToggleRow(
                icon: Icons.cloud_off_outlined,
                label: 'Offline sensors',
                value: settings.offlineSensors,
                onChanged: settings.setOfflineSensors),
          ]),
        ),
        SizedBox(height: 22),
        SectionTitle('Preferences & support'),
        AppCard(
          shadow: false,
          padding: EdgeInsets.zero,
          child: Column(children: [
            _NavRow(
                icon: Icons.speed_rounded, label: 'Units', trailing: 'Metric'),
            Divider(height: 1, color: AppColors.border),
            _NavRow(icon: Icons.help_outline_rounded, label: 'Help & support'),
            Divider(height: 1, color: AppColors.border),
            _NavRow(icon: Icons.settings_outlined, label: 'Privacy & about'),
          ]),
        ),
        SizedBox(height: 22),
        SizedBox(
          height: 52,
          child: OutlinedButton(
            onPressed: onSignOut,
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.red,
              side: BorderSide(color: AppColors.red.withValues(alpha: .4)),
              backgroundColor: AppColors.red.withValues(alpha: .08),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16)),
            ),
            child:
                Text('Sign out', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ),
      ]),
    );
  }
}

class _Segmented extends StatelessWidget {
  final ThemeChoice value;
  final ValueChanged<ThemeChoice> onChanged;
  _Segmented({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final labels = {
      ThemeChoice.light: 'Light',
      ThemeChoice.dark: 'Dark',
      ThemeChoice.system: 'System',
    };
    return Container(
      padding: EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(11),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        for (final entry in labels.entries)
          GestureDetector(
            onTap: () => onChanged(entry.key),
            child: Container(
              padding: EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                color: value == entry.key ? AppColors.blue : Colors.transparent,
              ),
              child: Text(entry.value,
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color:
                          value == entry.key ? Colors.white : AppColors.muted)),
            ),
          ),
      ]),
    );
  }
}

class _ToggleRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;
  _ToggleRow(
      {required this.icon,
      required this.label,
      required this.value,
      required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      child: Row(children: [
        Icon(icon, size: 22),
        SizedBox(width: 11),
        Expanded(child: Text(label)),
        Switch(
          value: value,
          onChanged: onChanged,
          activeColor: Colors.white,
          activeTrackColor: AppColors.blue,
        ),
      ]),
    );
  }
}

class _NavRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? trailing;
  _NavRow({required this.icon, required this.label, this.trailing});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () {},
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: 14, vertical: 16),
        child: Row(children: [
          Icon(icon, size: 22),
          SizedBox(width: 11),
          Text(label),
          if (trailing != null) ...[
            SizedBox(width: 8),
            Text(trailing!,
                style: TextStyle(color: AppColors.muted, fontSize: 11)),
          ],
          Spacer(),
          Icon(Icons.chevron_right_rounded, color: AppColors.muted),
        ]),
      ),
    );
  }
}
