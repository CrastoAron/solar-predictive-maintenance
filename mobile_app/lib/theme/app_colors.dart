import 'package:flutter/material.dart';

/// Design tokens ported from the CSS variables in index.css.
class AppColors {
  AppColors._();

  static bool isDark = true;
  static Color get bg =>
      isDark ? const Color(0xFF031322) : const Color(0xFFF3F7FC);
  static Color get bgGlow =>
      isDark ? const Color(0xFF092C4A) : const Color(0xFFE3F1FF);
  static Color get surface => isDark ? const Color(0xFF081D32) : Colors.white;
  static Color get surface2 =>
      isDark ? const Color(0xFF0B2541) : const Color(0xFFEAF2FA);
  static Color get border =>
      isDark ? const Color(0xFF143654) : const Color(0xFFD6E1EC);
  static Color get text =>
      isDark ? const Color(0xFFF4F8FF) : const Color(0xFF14263A);
  static Color get muted =>
      isDark ? const Color(0xFF91A6BF) : const Color(0xFF61758B);
  static Color get navInactive =>
      isDark ? const Color(0xFF718AA7) : const Color(0xFF71859A);
  static const blue = Color(0xFF0789FF);
  static const blueDark = Color(0xFF066DD8);
  static const cyan = Color(0xFF12C8FF);
  static const green = Color(0xFF08DF83);
  static const amber = Color(0xFFFFBE0B);
  static const red = Color(0xFFFF4D68);

  static const double radius = 19;
}
