import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import 'app_card.dart';
import 'icon_tile.dart';

class MetricTile extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;
  final Color accent;

  /// Stacked layout used in the 3-column grids.
  final bool vertical;

  MetricTile({
    super.key,
    required this.icon,
    required this.value,
    required this.label,
    this.accent = AppColors.cyan,
    this.vertical = false,
  });

  @override
  Widget build(BuildContext context) {
    final text = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(value,
            style: TextStyle(
                fontSize: 16, fontWeight: FontWeight.w800, height: 1.1)),
        SizedBox(height: 5),
        Text(label, style: TextStyle(color: AppColors.muted, fontSize: 10)),
      ],
    );
    return AppCard(
      shadow: false,
      padding:
          EdgeInsets.symmetric(horizontal: vertical ? 10 : 13, vertical: 13),
      child: vertical
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                IconTile(icon: icon, color: accent),
                SizedBox(height: 10),
                text,
              ],
            )
          : Row(
              children: [
                IconTile(icon: icon, color: accent),
                SizedBox(width: 11),
                Expanded(child: text),
              ],
            ),
    );
  }
}

/// Lays metric tiles out in equal-width columns.
class MetricRow extends StatelessWidget {
  final List<Widget> children;
  MetricRow({super.key, required this.children});

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) SizedBox(width: 10),
            Expanded(child: children[i]),
          ],
        ],
      ),
    );
  }
}
