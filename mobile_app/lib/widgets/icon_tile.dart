import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// Rounded square icon container (.icon-tile / .section-icon / .panel-icon).
class IconTile extends StatelessWidget {
  final IconData icon;
  final Color color;
  final double size;

  IconTile({
    super.key,
    required this.icon,
    this.color = AppColors.cyan,
    this.size = 40,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveColor = color == AppColors.cyan &&
            Theme.of(context).brightness == Brightness.light
        ? const Color(0xFF08728C)
        : color;
    final bg = effectiveColor == AppColors.cyan ||
            effectiveColor == const Color(0xFF08728C)
        ? AppColors.blue.withValues(alpha: .14)
        : effectiveColor.withValues(alpha: .12);
    return Container(
      width: size,
      height: size,
      decoration:
          BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Icon(icon, color: effectiveColor, size: 22),
    );
  }
}
