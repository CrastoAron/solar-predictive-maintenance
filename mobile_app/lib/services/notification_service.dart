import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class NotificationService {
  NotificationService._();

  static final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();
  static bool _initialized = false;

  static Future<void> initialize() async {
    if (kIsWeb ||
        (defaultTargetPlatform != TargetPlatform.android &&
            defaultTargetPlatform != TargetPlatform.iOS)) {
      return;
    }

    const settings = InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(
        requestAlertPermission: true,
        requestBadgePermission: true,
        requestSoundPermission: true,
      ),
    );
    await _plugin.initialize(settings: settings);

    if (defaultTargetPlatform == TargetPlatform.android) {
      await _plugin
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.requestNotificationsPermission();
    }
    _initialized = true;
  }

  static Future<void> showAlert(Map<String, dynamic> alert) async {
    if (!_initialized) return;

    final severity = (alert['severity'] ?? 'info').toString().toUpperCase();
    final panel =
        (alert['panel_name'] ?? alert['device_id'] ?? 'SolarShield').toString();
    final message =
        (alert['message'] ?? 'A new alert needs your attention.').toString();
    final timestamp = DateTime.tryParse(alert['timestamp']?.toString() ?? '');
    final id = (timestamp?.millisecondsSinceEpoch ??
            DateTime.now().millisecondsSinceEpoch) &
        0x7fffffff;

    const androidDetails = AndroidNotificationDetails(
      'solar_alerts',
      'Solar alerts',
      channelDescription: 'Notifications for new solar system alerts',
      importance: Importance.max,
      priority: Priority.high,
      playSound: true,
      enableVibration: true,
    );
    const darwinDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );
    await _plugin.show(
      id: id,
      title: '$severity alert · $panel',
      body: message,
      notificationDetails: const NotificationDetails(
        android: androidDetails,
        iOS: darwinDetails,
      ),
      payload: alert['id']?.toString(),
    );
  }
}
