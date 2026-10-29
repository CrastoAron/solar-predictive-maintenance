import 'package:flutter/material.dart';

/// Centered, max-width (620) scrolling column used by every tab screen.
class ScreenBody extends StatelessWidget {
  final List<Widget> children;
  final ScrollPhysics? physics;
  const ScreenBody({super.key, required this.children, this.physics});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 620),
        child: ListView(
          physics: physics,
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 24),
          children: children,
        ),
      ),
    );
  }
}
