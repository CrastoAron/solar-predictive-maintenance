import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../services/solar_data_service.dart';

class PageHeader extends StatelessWidget {
  final String title;
  final String subtitle;

  PageHeader({super.key, required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(2, 5, 2, 18),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(subtitle,
                    style: TextStyle(color: AppColors.muted, fontSize: 12)),
                SizedBox(height: 2),
                Text(title,
                    style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -.8)),
              ],
            ),
          ),
          _NotificationBell(),
        ],
      ),
    );
  }
}

class _NotificationBell extends StatelessWidget {
  const _NotificationBell();

  @override
  Widget build(BuildContext context) {
    final data = SolarDataService.instance;
    return ListenableBuilder(
      listenable: data,
      builder: (context, _) {
        final activeCount =
            data.alerts.where((alert) => alert['resolved'] != true).length;
        return Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.border),
              ),
              child: IconButton(
                tooltip: 'Recent alerts',
                onPressed: () => _showRecentAlerts(context),
                icon: const Icon(Icons.notifications_none_rounded, size: 22),
                padding: EdgeInsets.zero,
              ),
            ),
            if (activeCount > 0)
              Positioned(
                right: -3,
                top: -3,
                child: Container(
                  constraints:
                      const BoxConstraints(minWidth: 18, minHeight: 18),
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  decoration: BoxDecoration(
                    color: AppColors.red,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.surface, width: 2),
                  ),
                  child: Center(
                    child: Text(activeCount > 9 ? '9+' : '$activeCount',
                        style: const TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                            color: Colors.white)),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }

  void _showRecentAlerts(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => Dialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 460, maxHeight: 560),
          child: ListenableBuilder(
            listenable: SolarDataService.instance,
            builder: (context, _) {
              final alerts = [...SolarDataService.instance.alerts]..sort(
                  (left, right) =>
                      _alertDate(right).compareTo(_alertDate(left)));
              final recent = alerts.take(8).toList();
              final activeCount =
                  alerts.where((alert) => alert['resolved'] != true).length;
              return Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      const Expanded(
                          child: Text('Recent alerts',
                              style: TextStyle(
                                  fontSize: 18, fontWeight: FontWeight.w800))),
                      if (activeCount > 0)
                        Text('$activeCount active',
                            style: TextStyle(
                                color: AppColors.red,
                                fontSize: 11,
                                fontWeight: FontWeight.w700)),
                      IconButton(
                          onPressed: () => Navigator.pop(dialogContext),
                          icon: const Icon(Icons.close_rounded),
                          tooltip: 'Close'),
                    ]),
                    const SizedBox(height: 6),
                    if (!SolarDataService.instance.hasBackendAlerts)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 24),
                        child: Center(
                            child: Text(
                                'Alerts are unavailable until the system responds.',
                                textAlign: TextAlign.center)),
                      )
                    else if (recent.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 24),
                        child: Center(
                            child: Text('No alerts reported.',
                                textAlign: TextAlign.center)),
                      )
                    else
                      Flexible(
                        child: ListView.separated(
                          shrinkWrap: true,
                          itemCount: recent.length,
                          separatorBuilder: (_, __) =>
                              Divider(color: AppColors.border, height: 1),
                          itemBuilder: (context, index) {
                            final alert = recent[index];
                            final severity = (alert['severity'] ?? 'low')
                                .toString()
                                .toLowerCase();
                            final color = severity == 'high'
                                ? AppColors.red
                                : severity == 'medium'
                                    ? AppColors.amber
                                    : AppColors.cyan;
                            final resolved = alert['resolved'] == true;
                            final time = _alertDate(alert);
                            return Padding(
                              padding: const EdgeInsets.symmetric(vertical: 11),
                              child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Padding(
                                        padding: const EdgeInsets.only(top: 4),
                                        child: Icon(Icons.circle,
                                            size: 9,
                                            color: resolved
                                                ? AppColors.muted
                                                : color)),
                                    const SizedBox(width: 11),
                                    Expanded(
                                        child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                          Row(children: [
                                            Expanded(
                                                child: Text(
                                                    (alert['type'] ??
                                                            'System alert')
                                                        .toString(),
                                                    style: const TextStyle(
                                                        fontSize: 13,
                                                        fontWeight:
                                                            FontWeight.w700))),
                                            Text(
                                                resolved
                                                    ? 'Resolved'
                                                    : severity.toUpperCase(),
                                                style: TextStyle(
                                                    fontSize: 9,
                                                    color: resolved
                                                        ? AppColors.muted
                                                        : color,
                                                    fontWeight:
                                                        FontWeight.w800)),
                                          ]),
                                          if ((alert['message'] ?? '')
                                              .toString()
                                              .isNotEmpty) ...[
                                            const SizedBox(height: 4),
                                            Text(alert['message'].toString(),
                                                style: TextStyle(
                                                    fontSize: 11,
                                                    height: 1.4,
                                                    color: AppColors.muted)),
                                          ],
                                          const SizedBox(height: 4),
                                          Text(
                                              time ==
                                                      DateTime
                                                          .fromMillisecondsSinceEpoch(
                                                              0)
                                                  ? 'Time unavailable'
                                                  : time
                                                      .toLocal()
                                                      .toString()
                                                      .substring(0, 16),
                                              style: TextStyle(
                                                  fontSize: 10,
                                                  color: AppColors.muted)),
                                        ])),
                                  ]),
                            );
                          },
                        ),
                      ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  static DateTime _alertDate(Map<String, dynamic> alert) =>
      DateTime.tryParse(alert['timestamp']?.toString() ?? '') ??
      DateTime.fromMillisecondsSinceEpoch(0);
}

class SplitHeading extends StatelessWidget {
  final String title;
  final String? trailing;
  SplitHeading(this.title, {super.key, this.trailing});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(2, 0, 2, 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(title,
              style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -.3)),
          if (trailing != null)
            Text(trailing!,
                style: TextStyle(color: AppColors.muted, fontSize: 11)),
        ],
      ),
    );
  }
}

class SectionTitle extends StatelessWidget {
  final String title;
  SectionTitle(this.title, {super.key});

  @override
  Widget build(BuildContext context) => SplitHeading(title);
}
