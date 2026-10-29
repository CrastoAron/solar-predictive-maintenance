import 'package:flutter/material.dart';
import '../services/solar_data_service.dart';
import '../theme/app_colors.dart';
import '../widgets/app_badge.dart';
import '../widgets/app_card.dart';
import '../widgets/charts.dart';
import '../widgets/icon_tile.dart';
import '../widgets/metric_tile.dart';
import '../widgets/page_header.dart';
import '../widgets/screen_body.dart';

class AnalysisScreen extends StatefulWidget {
  AnalysisScreen({super.key});

  @override
  State<AnalysisScreen> createState() => _AnalysisScreenState();
}

class _AnalysisScreenState extends State<AnalysisScreen> {
  String _range = '7D';

  @override
  void initState() {
    super.initState();
    SolarDataService.instance.loadAnalysis(_range);
  }

  String _fmt(double v) {
    final s = v.toStringAsFixed(v % 1 == 0 ? 0 : 1);
    final parts = s.split('.');
    final whole =
        parts[0].replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => ',');
    return parts.length > 1 ? '$whole.${parts[1]}' : whole;
  }

  @override
  Widget build(BuildContext context) {
    final data = SolarDataService.instance;

    return ListenableBuilder(
      listenable: data,
      builder: (context, _) {
        final a = data.getAnalysis(_range);
        return ScreenBody(children: [
          PageHeader(
              title: 'Performance analysis', subtitle: 'Historical insights'),

          // Range tabs
          Container(
            padding: EdgeInsets.all(4),
            margin: EdgeInsets.only(bottom: 14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(15),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(children: [
              for (final r in SolarDataService.analysisRanges)
                Expanded(
                  child: GestureDetector(
                    onTap: () {
                      setState(() => _range = r);
                      data.loadAnalysis(r);
                    },
                    child: AnimatedContainer(
                      duration: Duration(milliseconds: 200),
                      padding: EdgeInsets.symmetric(vertical: 11),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(11),
                        color:
                            _range == r ? AppColors.blue : Colors.transparent,
                      ),
                      child: Text(r,
                          style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: _range == r
                                  ? Colors.white
                                  : AppColors.muted)),
                    ),
                  ),
                ),
            ]),
          ),

          AppCard(
            padding: EdgeInsets.all(17),
            child: Column(children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                            data.isAnalysisLoading(_range)
                                ? 'Loading telemetry CSV'
                                : data.hasAnalysisHistory(_range)
                                    ? 'Energy production'
                                    : 'Energy unavailable',
                            style: TextStyle(
                                color: AppColors.muted, fontSize: 11)),
                        Text.rich(TextSpan(children: [
                          TextSpan(
                              text:
                                  '${data.hasAnalysisHistory(_range) ? _fmt(a.energyKwh) : '—'} ',
                              style: TextStyle(
                                  fontSize: 26, fontWeight: FontWeight.w800)),
                          TextSpan(
                              text: 'kWh',
                              style: TextStyle(
                                  fontSize: 12, color: AppColors.muted)),
                        ])),
                      ]),
                  AppBadge(data.hasAnalysisHistory(_range)
                      ? '${a.changePercent >= 0 ? '↑' : '↓'} ${_fmt(a.changePercent.abs())}%'
                      : 'Unavailable'),
                ],
              ),
              if (data.isAnalysisLoading(_range))
                Padding(
                  padding: EdgeInsets.symmetric(vertical: 28),
                  child: CircularProgressIndicator(),
                )
              else ...[
                BarChartView(values: a.bars),
                ChartAxis(a.axisLabels),
              ],
            ]),
          ),

          SizedBox(height: 23),
          MetricTile(
            icon: Icons.bolt_rounded,
            value: data.hasAnalysisHistory(_range)
                ? '${_fmt(a.averagePowerWatts)} W'
                : '—',
            label: 'Average power',
            accent: AppColors.amber,
          ),

          SizedBox(height: 22),
          if (data.isAnalysisLoading(_range))
            AppCard(
              padding: EdgeInsets.all(17),
              child: Text('Loading historical telemetry from the app asset…',
                  style: TextStyle(color: AppColors.muted, fontSize: 12)),
            )
          else if (!data.hasAnalysisHistory(_range))
            AppCard(
              padding: EdgeInsets.all(17),
              child: Text(a.comparisonNote,
                  style: TextStyle(
                      color: AppColors.muted, fontSize: 12, height: 1.5)),
            )
          else
            AppCard(
              padding: EdgeInsets.all(17),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Measured power history',
                        style: TextStyle(
                            fontSize: 17, fontWeight: FontWeight.w800)),
                    SizedBox(height: 12),
                    PowerHistoryLineChart(points: a.actualCurve),
                    SizedBox(height: 12),
                    Text(a.comparisonNote,
                        style: TextStyle(
                            color: AppColors.muted, fontSize: 12, height: 1.5)),
                  ]),
            ),

          SizedBox(height: 23),
          AppCard(
            shadow: false,
            padding: EdgeInsets.all(14),
            child: Row(children: [
              IconTile(icon: Icons.speed_rounded),
              SizedBox(width: 11),
              Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Degradation indicator',
                          style: TextStyle(fontWeight: FontWeight.w700)),
                      SizedBox(height: 3),
                      Text(a.degradationLabel,
                          style:
                              TextStyle(color: AppColors.muted, fontSize: 10)),
                    ]),
              ),
              AppBadge(a.degradationStatus),
            ]),
          ),
        ]);
      },
    );
  }
}
