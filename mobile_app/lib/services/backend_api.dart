import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'auth_service.dart';

class BackendApi {
  BackendApi({http.Client? client, String? baseUrl})
      : _client = client ?? http.Client(),
        _baseUrl = (baseUrl ??
                const String.fromEnvironment(
                  'SOLAR_API_BASE_URL',
                  defaultValue: 'https://chain-quarters-thread.ngrok-free.dev',
                ))
            .replaceFirst(RegExp(r'/$'), '');

  final http.Client _client;
  final String _baseUrl;

  String get baseUrl {
    if (_baseUrl.isNotEmpty) return _baseUrl;
    return defaultTargetPlatform == TargetPlatform.android
        ? 'http://10.0.2.2:8000'
        : 'http://localhost:8000';
  }

  Future<dynamic> get(
    String path, {
    Map<String, String> query = const {},
  }) async {
    final token = await AuthService.instance.accessToken;
    if (token == null || token.isEmpty) {
      throw const BackendException('Sign in to connect to your solar system.');
    }

    final uri = Uri.parse('$baseUrl$path').replace(queryParameters: query);
    final response = await _client.get(uri, headers: {
      'Authorization': 'Bearer $token',
      'Accept': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    });
    if (response.statusCode < 200 || response.statusCode >= 300) {
      String message = 'Backend request failed (${response.statusCode}).';
      try {
        final body = jsonDecode(response.body);
        if (body is Map && body['detail'] is String) {
          message = body['detail'] as String;
        }
      } catch (_) {}
      throw BackendException(message, statusCode: response.statusCode);
    }
    if (response.body.isEmpty) return null;
    return jsonDecode(response.body);
  }

  Future<dynamic> post(String path,
      {required Map<String, dynamic> body}) async {
    final token = await AuthService.instance.accessToken;
    if (token == null || token.isEmpty) {
      throw const BackendException('Sign in to connect to your solar system.');
    }

    final uri = Uri.parse('$baseUrl$path');
    final response = await _client.post(
      uri,
      headers: {
        'Authorization': 'Bearer $token',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: jsonEncode(body),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      String message = 'Backend request failed (${response.statusCode}).';
      try {
        final decoded = jsonDecode(response.body);
        if (decoded is Map && decoded['detail'] is String) {
          message = decoded['detail'] as String;
        }
      } catch (_) {}
      throw BackendException(message, statusCode: response.statusCode);
    }
    if (response.body.isEmpty) return null;
    return jsonDecode(response.body);
  }

  void close() => _client.close();
}

class BackendException implements Exception {
  const BackendException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}
