import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

enum BadgeTone { good, warn, bad, info }

Color toneColor(BadgeTone tone, {required bool isDark}) {
  if (!isDark) {
    switch (tone) {
      case BadgeTone.good:
        return const Color(0xFF176B43);
      case BadgeTone.warn:
        return const Color(0xFF8A5A00);
      case BadgeTone.bad:
        return const Color(0xFFB4233F);
      case BadgeTone.info:
        return const Color(0xFF08728C);
    }
  }
  switch (tone) {
    case BadgeTone.good:
      return AppColors.green;
    case BadgeTone.warn:
      return AppColors.amber;
    case BadgeTone.bad:
      return AppColors.red;
    case BadgeTone.info:
      return AppColors.cyan;
  }
}

class AppBadge extends StatelessWidget {
  final String label;
  final BadgeTone tone;

  AppBadge(this.label, {super.key, this.tone = BadgeTone.good});

  @override
  Widget build(BuildContext context) {
    final color = toneColor(
      tone,
      isDark: Theme.of(context).brightness == Brightness.dark,
    );
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        maxLines: 1,
        style:
            TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w700),
      ),
    );
  }
}
