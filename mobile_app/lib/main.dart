import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'services/auth_service.dart';
import 'services/solar_data_service.dart';
import 'screens/main_shell.dart';
import 'screens/onboarding_screen.dart';
import 'services/settings_service.dart';
import 'services/notification_service.dart';
import 'theme/app_theme.dart';
import 'theme/app_colors.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.light);
  await AuthService.instance.initialize();
  await SettingsService.instance.load();
  await NotificationService.initialize();
  final active = AuthService.instance.user != null;
  runApp(SolarShieldApp(initiallyAuthenticated: active));
}

class SolarShieldApp extends StatefulWidget {
  final bool initiallyAuthenticated;
  const SolarShieldApp({super.key, required this.initiallyAuthenticated});

  @override
  State<SolarShieldApp> createState() => _SolarShieldAppState();
}

class _SolarShieldAppState extends State<SolarShieldApp>
    with WidgetsBindingObserver {
  late bool _authenticated = widget.initiallyAuthenticated;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _syncBrightness();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangePlatformBrightness() {
    _syncBrightness();
    setState(() {});
  }

  void _syncBrightness() {
    final choice = SettingsService.instance.theme;
    AppColors.isDark = choice == ThemeChoice.dark ||
        (choice == ThemeChoice.system &&
            WidgetsBinding.instance.platformDispatcher.platformBrightness ==
                Brightness.dark);
  }

  Future<void> _signOut() async {
    await AuthService.instance.signOut();
    SolarDataService.instance.clearBackendData();
    if (mounted) setState(() => _authenticated = false);
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: SettingsService.instance,
      builder: (context, _) {
        _syncBrightness();
        final choice = SettingsService.instance.theme;
        return MaterialApp(
          title: 'SolarShield',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light,
          darkTheme: AppTheme.dark,
          themeMode: choice == ThemeChoice.system
              ? ThemeMode.system
              : choice == ThemeChoice.light
                  ? ThemeMode.light
                  : ThemeMode.dark,
          home: _authenticated
              ? MainShell(onSignOut: _signOut)
              : OnboardingScreen(
                  onComplete: () => setState(() => _authenticated = true)),
        );
      },
    );
  }
}
