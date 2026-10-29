import 'package:flutter/material.dart';
import '../models/live_readings.dart';
import '../models/solar_panel.dart';
import '../services/solar_data_service.dart';
import '../theme/app_colors.dart';
import '../widgets/app_badge.dart';
import '../widgets/app_card.dart';
import '../widgets/charts.dart';
import '../widgets/icon_tile.dart';
import '../widgets/metric_tile.dart';
import '../widgets/page_header.dart';
import '../widgets/screen_body.dart';

class MonitoringScreen extends StatelessWidget {
  MonitoringScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final data = SolarDataService.instance;
    return ListenableBuilder(
      listenable: data,
      builder: (context, _) {
        final r = data.getLiveReadings();
        final panels = data.getPanels();
        return RefreshIndicator(
          onRefresh: data.refreshFromBackend,
          child: ScreenBody(
            physics: AlwaysScrollableScrollPhysics(),
            children: [
              PageHeader(
                  title: 'Live monitoring', subtitle: 'Installation overview'),
              Padding(
                padding: EdgeInsets.only(left: 2, bottom: 12),
                child: Row(children: [
                  AppBadge(data.hasLiveData ? '● LIVE' : '● NO DATA'),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                        data.hasLiveData
                            ? 'Connected'
                            : 'Waiting for data',
                        style: TextStyle(color: AppColors.muted, fontSize: 11)),
                  ),
                  if (data.isRefreshing)
                    SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.blue,
                      ),
                    )
                  else
                    IconButton(
                      tooltip: 'Refresh monitoring data',
                      visualDensity: VisualDensity.compact,
                      onPressed: data.refreshFromBackend,
                      icon: Icon(Icons.refresh_rounded, color: AppColors.blue),
                    ),
                ]),
              ),
              MetricRow(children: [
                MetricTile(
                    vertical: true,
                    icon: Icons.bolt_rounded,
                    value: data.hasLiveData ? formatPower(r.powerWatts) : '—',
                    label: 'Live power',
                    accent: AppColors.amber),
                MetricTile(
                    vertical: true,
                    icon: Icons.electrical_services_rounded,
                    value: data.hasLiveData
                        ? '${r.voltageV.toStringAsFixed(2)} V'
                        : '—',
                    label: 'Voltage'),
                MetricTile(
                    vertical: true,
                    icon: Icons.speed_rounded,
                    value: data.hasLiveData
                        ? '${r.currentA.toStringAsFixed(3)} A'
                        : '—',
                    label: 'Current',
                    accent: AppColors.green),
              ]),
              SizedBox(height: 22),
              AppCard(
                padding: EdgeInsets.all(17),
                child: Column(children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Power generation',
                          style: TextStyle(
                              fontSize: 17, fontWeight: FontWeight.w800)),
                      AppBadge(data.hasLiveData ? 'Measured' : 'Unavailable'),
                    ],
                  ),
                  SizedBox(height: 14),
                  PowerLineChart(
                    samples: r.powerSamples,
                    sessionStartedAt: r.sessionStartedAt,
                  ),
                  if (r.powerSamples.isEmpty)
                    Padding(
                      padding: EdgeInsets.only(top: 8),
                      child: Text(
                        'Waiting for the first live reading…',
                        style: TextStyle(color: AppColors.muted, fontSize: 11),
                      ),
                    ),
                ]),
              ),
              SizedBox(height: 23),
              SectionTitle('Environmental conditions'),
              MetricRow(children: [
                MetricTile(
                    vertical: true,
                    icon: Icons.thermostat_rounded,
                    value: data.hasLiveData ? '${r.panelTempC}°C' : '—',
                    label: 'Panel temp',
                    accent: AppColors.red),
                MetricTile(
                    vertical: true,
                    icon: Icons.wb_sunny_outlined,
                    value: data.hasLiveData
                        ? '${r.irradianceWm2.toStringAsFixed(0)} W/m²'
                        : '—',
                    label: 'Irradiance',
                    accent: AppColors.amber),
                MetricTile(
                    vertical: true,
                    icon: Icons.water_drop_outlined,
                    value: data.hasLiveData ? '${r.humidityPercent}%' : '—',
                    label: 'Humidity'),
              ]),
              SizedBox(height: 22),
              SplitHeading('Panel status', trailing: 'Tap to inspect'),
              AppCard(
                padding: EdgeInsets.zero,
                child: Column(children: [
                  if (panels.isEmpty)
                    Padding(
                      padding: EdgeInsets.all(20),
                      child: Text('No panels are assigned to this account.',
                          style: TextStyle(color: AppColors.muted)),
                    ),
                  for (var i = 0; i < panels.length; i++) ...[
                    if (i > 0) Divider(height: 1, color: AppColors.border),
                    InkWell(
                      borderRadius: BorderRadius.circular(AppColors.radius),
                      onTap: () => _showPanel(context, panels[i]),
                      child: Padding(
                        padding: EdgeInsets.all(13),
                        child: Row(children: [
                          IconTile(icon: Icons.grid_view_rounded),
                          SizedBox(width: 12),
                          Expanded(
                            child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(panels[i].name,
                                      style: TextStyle(
                                          fontWeight: FontWeight.w700)),
                                ]),
                          ),
                          Icon(Icons.chevron_right_rounded,
                              size: 18, color: AppColors.muted),
                        ]),
                      ),
                    ),
                  ],
                ]),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showPanel(BuildContext context, SolarPanel p) {
    final hardwareFuture =
        SolarDataService.instance.getHardwareStatus(deviceId: p.deviceId);
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      isScrollControlled: true,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => SafeArea(
        child: Padding(
          padding: EdgeInsets.fromLTRB(24, 24, 24, 12),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(p.name,
                    style:
                        TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                SizedBox(height: 18),
                Text('Sensor hardware status',
                    style:
                        TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                SizedBox(height: 10),
                FutureBuilder<Map<String, dynamic>?>(
                  future: hardwareFuture,
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return Padding(
                        padding: EdgeInsets.symmetric(vertical: 24),
                        child: Center(child: CircularProgressIndicator()),
                      );
                    }
                    if (snapshot.hasError) {
                      return Text(
                        'Could not load sensor status: ${snapshot.error}',
                        style: TextStyle(color: AppColors.red, fontSize: 12),
                      );
                    }
                    final status = snapshot.data;
                    if (status == null) {
                      return Text(
                        'No hardware status has been reported for this panel.',
                        style: TextStyle(color: AppColors.muted, fontSize: 12),
                      );
                    }
                    return Column(
                      children: [
                        _sensorStatusRow('BME280', 'Temperature & humidity',
                            status['bme280']),
                        _sensorStatusRow(
                            'INA219', 'Voltage & current', status['ina219']),
                        _sensorStatusRow(
                            'BH1750', 'Light level', status['bh1750']),
                        _sensorStatusRow(
                            'DS3231', 'Real-time clock', status['ds3231']),
                      ],
                    );
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _sensorStatusRow(String name, String description, dynamic value) {
    final code = value is num ? value.toInt() : int.tryParse('$value');
    final label = switch (code) {
      0 => 'OK',
      1 => 'Initialization failed',
      2 => 'Device not found',
      3 => 'Invalid data',
      4 => 'Read error',
      5 => 'Device-specific error',
      _ => 'Unavailable',
    };
    final healthy = code == 0;
    final color = healthy ? AppColors.green : AppColors.red;
    return Padding(
      padding: EdgeInsets.symmetric(vertical: 9),
      child: Row(children: [
        Icon(
          healthy ? Icons.check_circle_outline : Icons.error_outline,
          size: 20,
          color: color,
        ),
        SizedBox(width: 11),
        Expanded(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(name, style: TextStyle(fontWeight: FontWeight.w700)),
            SizedBox(height: 2),
            Text(description,
                style: TextStyle(color: AppColors.muted, fontSize: 11)),
          ]),
        ),
        Text(label,
            style: TextStyle(
                color: code == null ? AppColors.muted : color,
                fontSize: 11,
                fontWeight: FontWeight.w700)),
      ]),
    );
  }
}
