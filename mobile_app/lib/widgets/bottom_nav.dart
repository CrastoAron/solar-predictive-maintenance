import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class NavItem {
  final String label;
  final IconData icon;
  const NavItem(this.label, this.icon);
}

const navItems = [
  NavItem('Home', Icons.home_outlined),
  NavItem('Monitoring', Icons.monitor_heart_outlined),
  NavItem('Analysis', Icons.bar_chart_rounded),
  NavItem('Service', Icons.build_outlined),
  NavItem('Settings', Icons.settings_outlined),
];

class AppBottomNav extends StatelessWidget {
  final int index;
  final ValueChanged<int> onChanged;

  const AppBottomNav({super.key, required this.index, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final safeBottom = MediaQuery.of(context).viewPadding.bottom;
    return Align(
      alignment: Alignment.bottomCenter,
      heightFactor: 1,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 620),
        child: Container(
          margin: EdgeInsets.fromLTRB(12, 0, 12, 12 + safeBottom),
          padding: EdgeInsets.fromLTRB(8, 9, 8, 4),
          decoration: BoxDecoration(
            color: AppColors.surface.withValues(alpha: .96),
            borderRadius: BorderRadius.circular(25),
            border: Border.all(color: AppColors.border),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: .3),
                blurRadius: 35,
                offset: const Offset(0, -15),
              ),
            ],
          ),
          child: Row(
            children: [
              for (var i = 0; i < navItems.length; i++)
                Expanded(
                  child: _NavButton(
                    item: navItems[i],
                    active: i == index,
                    onTap: () => onChanged(i),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  final NavItem item;
  final bool active;
  final VoidCallback onTap;

  const _NavButton(
      {required this.item, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        height: 58,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: active
              ? const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFF087EE5), Color(0xFF0563C8)],
                )
              : null,
          boxShadow: active
              ? [
                  BoxShadow(
                    color: AppColors.blue.withValues(alpha: .25),
                    blurRadius: 24,
                    offset: const Offset(0, 10),
                  )
                ]
              : null,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(item.icon,
                size: 22,
                color: active ? AppColors.cyan : AppColors.navInactive),
            const SizedBox(height: 3),
            Text(item.label,
                style: TextStyle(
                    fontSize: 9,
                    color: active ? Colors.white : AppColors.navInactive)),
          ],
        ),
      ),
    );
  }
}
