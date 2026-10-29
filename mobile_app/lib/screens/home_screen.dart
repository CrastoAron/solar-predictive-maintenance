import 'package:flutter/material.dart';
import '../services/solar_data_service.dart';
import '../theme/app_colors.dart';
import '../utils/date_format.dart';
import '../widgets/app_badge.dart';
import '../widgets/app_card.dart';
import '../widgets/icon_tile.dart';
import '../widgets/metric_tile.dart';
import '../widgets/page_header.dart';
import '../widgets/screen_body.dart';

class HomeScreen extends StatelessWidget {
  HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final data = SolarDataService.instance;
    final now = DateTime.now();

    return ListenableBuilder(
      listenable: data,
      builder: (context, _) {
        final s = data.getSystemSummary();
        final isDark = Theme.of(context).brightness == Brightness.dark;
        final isNight = now.hour < 6 || now.hour >= 18;
        final diagnosis = s.diagnosisTitle.toLowerCase();
        final statusColor = diagnosis.contains('fault')
            ? (isDark ? AppColors.red : const Color(0xFFB4233D))
            : diagnosis.contains('degrad')
                ? (isDark ? AppColors.amber : const Color(0xFF8A5A00))
                : diagnosis.contains('normal')
                    ? (isDark ? AppColors.green : const Color(0xFF176B43))
                    : AppColors.muted;
        final warningColor = isDark ? AppColors.amber : const Color(0xFF8A5A00);
        final accentColor = isDark ? AppColors.cyan : const Color(0xFF08728C);
        return SizedBox.expand(
          child: ScreenBody(children: [
            PageHeader(
              title: '${greetingFor(now)}, ${data.profile.firstName}',
              subtitle: formatLongDate(now),
            ),
            Padding(
              padding: EdgeInsets.only(left: 2, bottom: 12),
              child: Row(children: [
                Text(data.backendConnected ? 'DATA OCCUPIED' : 'NO SYSTEM DATA',
                    style: TextStyle(
                        color: accentColor,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: .8)),
                SizedBox(width: 8),
                Text(
                    data.backendUpdatedAt == null
                        ? 'Waiting for backend data'
                        : 'Updated ${data.backendUpdatedAt!.toLocal().toString().substring(11, 16)}',
                    style: TextStyle(color: AppColors.muted, fontSize: 11)),
              ]),
            ),
            // Hero
            AppCard(
              padding: EdgeInsets.all(20),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: isDark
                    ? [Color(0xFF0B2744), Color(0xFF07192B)]
                    : [Color(0xFFE5F2FF), Color(0xFFD9EAFE)],
              ),
              child: Stack(
                children: [
                  Positioned(
                    right: 0,
                    bottom: 10,
                    child: Icon(
                        isNight
                            ? Icons.nights_stay_outlined
                            : Icons.wb_sunny_outlined,
                        size: 34,
                        color: isNight ? AppColors.cyan : AppColors.amber,
                        shadows: [
                          Shadow(
                              color: (isNight ? AppColors.cyan : AppColors.amber)
                                  .withValues(alpha: .4),
                              blurRadius: 10)
                        ]),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Container(
                          width: 9,
                          height: 9,
                          decoration: BoxDecoration(
                            color: statusColor,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(color: statusColor, blurRadius: 12)
                            ],
                          ),
                        ),
                        SizedBox(width: 8),
                        Text(
                            data.backendConnected
                                ? s.diagnosisTitle
                                : 'No system data',
                            style: TextStyle(
                                fontSize: 13, fontWeight: FontWeight.w700)),
                        SizedBox(width: 8),
                        AppBadge(data.backendConnected
                            ? 'Status'
                            : 'Waiting for data'),
                      ]),
                      SizedBox(height: 20),
                      Text(
                          data.backendConnected
                              ? '${s.efficiencyPercent.toStringAsFixed(2).replaceFirst(RegExp(r'\.?0+$'), '')}%'
                              : '—',
                          style: TextStyle(
                              fontSize: 38,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -1.5)),
                      Text('overall efficiency',
                          style:
                              TextStyle(fontSize: 13, color: AppColors.muted)),
                      SizedBox(height: 2),
                      FractionallySizedBox(
                        widthFactor: .72,
                        child: Text(
                          data.backendConnected
                              ? '${s.healthyPanels} of ${s.totalPanels} panels reported healthy.'
                              : 'System metrics will appear when backend data is available.',
                          style: TextStyle(
                              fontSize: 12,
                              height: 1.5,
                              color: AppColors.muted),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            SizedBox(height: 12),
            MetricRow(children: [
              MetricTile(
                  icon: Icons.grid_view_rounded,
                  value: data.backendConnected ? '${s.totalPanels}' : '—',
                  label: 'Total panels'),
              MetricTile(
                  icon: Icons.bolt_rounded,
                  value: data.backendConnected
                      ? '${s.capacityKw.toStringAsFixed(1)} kW'
                      : '—',
                  label: 'System capacity',
                  accent: AppColors.green),
            ]),

            SizedBox(height: 23),
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    flex: 3,
                    child: AppCard(
                      padding: EdgeInsets.all(15),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          IconTile(icon: Icons.speed_rounded),
                          SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('System diagnosis',
                                    style: TextStyle(
                                        color: AppColors.muted, fontSize: 10)),
                                SizedBox(height: 2),
                                Text(s.diagnosisTitle,
                                    style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w800)),
                                SizedBox(height: 5),
                                Text(s.diagnosisMessage,
                                    style: TextStyle(
                                        color: AppColors.muted,
                                        fontSize: 9,
                                        height: 1.5)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  SizedBox(width: 10),
                  Expanded(
                    child: AppCard(
                      padding:
                          EdgeInsets.symmetric(horizontal: 6, vertical: 15),
                      child: Column(
                        children: [
                          Text('Recent alerts',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                  color: AppColors.muted, fontSize: 10)),
                          SizedBox(height: 5),
                          Text(
                              data.hasBackendAlerts ? '${s.activeAlerts}' : '—',
                              style: TextStyle(
                                  fontSize: 32,
                                  fontWeight: FontWeight.w800,
                                  color: !data.hasBackendAlerts
                                      ? AppColors.muted
                                      : s.activeAlerts == 0
                                          ? statusColor
                                          : warningColor)),
                          SizedBox(height: 5),
                          Text(
                              data.hasBackendAlerts
                                  ? (s.activeAlerts == 0
                                      ? 'No active warnings'
                                      : 'Requires review')
                                  : 'Alerts unavailable',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                  color: AppColors.muted,
                                  fontSize: 9,
                                  height: 1.5)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),

            SizedBox(height: 22),
            SectionTitle('Panel health'),
            AppCard(
              shadow: false,
              padding: EdgeInsets.all(14),
              child: Row(
                children: [
                  Icon(Icons.grid_view_rounded, color: accentColor),
                  SizedBox(width: 11),
                  Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                              data.hasBackendPanelData
                                  ? '${s.totalPanels} panels registered'
                                  : 'Panel data unavailable',
                              style: TextStyle(fontWeight: FontWeight.w700)),
                          SizedBox(height: 3),
                          Text(
                              data.hasBackendPanelData
                                  ? '${s.healthyPanels} health statuses · ${s.watchPanels} need attention'
                                  : 'No panel health data received',
                              style: TextStyle(
                                  color: AppColors.muted, fontSize: 10)),
                        ]),
                  ),
                  AppBadge(
                      data.hasBackendPanelData ? 'Registered' : 'Unavailable'),
                ],
              ),
            ),
          ]),
        );
      },
    );
  }
}
