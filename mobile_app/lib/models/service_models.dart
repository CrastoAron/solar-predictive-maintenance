enum MaintenanceState { done, upcoming, recommended }

class MaintenanceTask {
  final String title;
  final String subtitle;
  final MaintenanceState state;

  const MaintenanceTask({
    required this.title,
    required this.subtitle,
    required this.state,
  });
}

class ServiceRecord {
  final String title;
  final String dateLabel;
  final String description;
  final bool completed;

  const ServiceRecord({
    required this.title,
    required this.dateLabel,
    required this.description,
    this.completed = true,
  });
}

class ServiceRequest {
  final String type;
  final String? preferredDate;
  final String? preferredTime;
  final String details;
  final DateTime createdAt;

  const ServiceRequest({
    required this.type,
    this.preferredDate,
    this.preferredTime,
    this.details = '',
    required this.createdAt,
  });

  Map<String, dynamic> toJson() => {
        'type': type,
        'preferredDate': preferredDate,
        'preferredTime': preferredTime,
        'details': details,
        'createdAt': createdAt.toIso8601String(),
      };

  Map<String, dynamic> toBackendJson() => {
        'service_type': type,
        'preferred_date': preferredDate,
        'preferred_time': preferredTime,
        'details': details,
      };

  factory ServiceRequest.fromJson(Map<String, dynamic> json) => ServiceRequest(
        type: json['type'] as String? ?? 'Service',
        preferredDate: json['preferredDate'] as String?,
        preferredTime: json['preferredTime'] as String?,
        details: json['details'] as String? ?? '',
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
            DateTime.now(),
      );
}
