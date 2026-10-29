import 'dart:async';

import 'package:flutter/material.dart';
import '../services/solar_data_service.dart';
import '../theme/app_colors.dart';
import '../widgets/bottom_nav.dart';
import 'analysis_screen.dart';
import 'home_screen.dart';
import 'monitoring_screen.dart';
import 'service_screen.dart';
import 'settings_screen.dart';

/// Authenticated shell: 5 tabs + bottom navigation (port of the `Screen` state
/// and `BottomNav` in App.tsx).
class MainShell extends StatefulWidget {
  final VoidCallback onSignOut;
  const MainShell({super.key, required this.onSignOut});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _index = 0;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    SolarDataService.instance.refreshFromBackend();
    _refreshTimer = Timer.periodic(
      const Duration(seconds: 10),
      (_) => SolarDataService.instance.refreshFromBackend(),
    );
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: RadialGradient(
            center: Alignment.topCenter,
            radius: 1.1,
            colors: [AppColors.bgGlow, AppColors.bg],
            stops: [0, .36],
          ),
        ),
        child: SafeArea(
          bottom: false,
          child: IndexedStack(
            index: _index,
            children: [
              HomeScreen(),
              MonitoringScreen(),
              AnalysisScreen(),
              ServiceScreen(),
              SettingsScreen(onSignOut: widget.onSignOut),
            ],
          ),
        ),
      ),
      bottomNavigationBar: AppBottomNav(
        index: _index,
        onChanged: (i) => setState(() => _index = i),
      ),
    );
  }
}
