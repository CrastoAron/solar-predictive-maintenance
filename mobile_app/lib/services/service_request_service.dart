import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/service_models.dart';
import 'backend_api.dart';

/// Sends new service requests to the backend and reads any legacy local requests.
class ServiceRequestService {
  ServiceRequestService._();
  static final ServiceRequestService instance = ServiceRequestService._();

  static const _key = 'service-requests';
  final BackendApi _api = BackendApi();

  Future<void> submitRequest(ServiceRequest request) async {
    await _api.post('/api/service-requests', body: request.toBackendJson());
  }

  Future<List<ServiceRequest>> getRequests() async {
    try {
      final p = await SharedPreferences.getInstance();
      final raw = p.getStringList(_key) ?? [];
      return raw
          .map((s) =>
              ServiceRequest.fromJson(jsonDecode(s) as Map<String, dynamic>))
          .toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    } catch (_) {
      return [];
    }
  }
}
