import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class PrimaryButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final Widget child;

  PrimaryButton({super.key, required this.onPressed, required this.child});

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null;
    return Opacity(
      opacity: enabled ? 1 : .65,
      child: Container(
        width: double.infinity,
        height: 54,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(17),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.blue, AppColors.blueDark],
          ),
          boxShadow: [
            BoxShadow(
              color: AppColors.blue.withValues(alpha: .3),
              blurRadius: 30,
              offset: Offset(0, 12),
            ),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(17),
            onTap: onPressed,
            child: Center(
              child: DefaultTextStyle(
                style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 15),
                child: child,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
