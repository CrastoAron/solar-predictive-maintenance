import 'dart:math' as math;

import 'package:flutter/material.dart';
import '../models/live_readings.dart';
import '../theme/app_colors.dart';

/// Vertical bar chart (port of .bar-chart). Values are 0..100.
class BarChartView extends StatelessWidget {
  final List<double> values;

  BarChartView({super.key, required this.values});

  List<double> _fitToWidth() {
    const maxBars = 24;
    if (values.length <= maxBars) return values;

    return List.generate(maxBars, (bucket) {
      final start = bucket * values.length ~/ maxBars;
      final end = (bucket + 1) * values.length ~/ maxBars;
      final points = values.sublist(start, end);
      return points.reduce((sum, value) => sum + value) / points.length;
    });
  }

  @override
  Widget build(BuildContext context) {
    final displayValues = _fitToWidth();
    final peakValue = displayValues.isEmpty
        ? 0.0
        : displayValues.reduce((a, b) => a > b ? a : b);
    final peak = displayValues.indexOf(peakValue);
    return Container(
      height: 112,
      margin: EdgeInsets.only(top: 18),
      padding: EdgeInsets.symmetric(horizontal: 3),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (var i = 0; i < displayValues.length; i++) ...[
            if (i > 0) SizedBox(width: 3),
            Expanded(
              child: FractionallySizedBox(
                heightFactor: (displayValues[i] / 100).clamp(0.02, 1.0),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius:
                        BorderRadius.vertical(top: Radius.circular(5)),
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: i == peak
                          ? [AppColors.green, Color(0xFF08A866)]
                          : [Color(0xFF1475CA), Color(0xFF0E3F70)],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class ChartAxis extends StatelessWidget {
  final List<String> labels;
  ChartAxis(this.labels, {super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(top: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          for (final l in labels)
            Text(l, style: TextStyle(color: AppColors.muted, fontSize: 9)),
        ],
      ),
    );
  }
}

/// Smooth line (optionally with gradient fill) drawn in a design-space
/// (viewBox) that is scaled to the widget size, like the SVG originals.
class SmoothLinePainter extends CustomPainter {
  final List<Offset2> points;
  final Size viewBox;
  final Color color;
  final double strokeWidth;
  final bool fill;

  SmoothLinePainter({
    required this.points,
    required this.viewBox,
    required this.color,
    this.strokeWidth = 3,
    this.fill = false,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (points.length < 2) return;
    final sx = size.width / viewBox.width;
    final sy = size.height / viewBox.height;
    final p = points.map((o) => Offset(o.x * sx, o.y * sy)).toList();

    final path = Path()..moveTo(p.first.dx, p.first.dy);
    for (var i = 1; i < p.length - 1; i++) {
      final mid =
          Offset((p[i].dx + p[i + 1].dx) / 2, (p[i].dy + p[i + 1].dy) / 2);
      path.quadraticBezierTo(p[i].dx, p[i].dy, mid.dx, mid.dy);
    }
    path.lineTo(p.last.dx, p.last.dy);

    if (fill) {
      final area = Path.from(path)
        ..lineTo(size.width, size.height)
        ..lineTo(0, size.height)
        ..close();
      canvas.drawPath(
        area,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [color.withValues(alpha: .36), color.withValues(alpha: 0)],
          ).createShader(Offset.zero & size),
      );
    }

    canvas.drawPath(
      path,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(covariant SmoothLinePainter old) =>
      old.points != points || old.color != color || old.fill != fill;
}

/// Session power chart with a watt scale and elapsed time since app launch.
class PowerLineChart extends StatelessWidget {
  final List<PowerSample> samples;
  final DateTime sessionStartedAt;

  PowerLineChart({
    super.key,
    required this.samples,
    required this.sessionStartedAt,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 190,
      width: double.infinity,
      child: CustomPaint(
        painter: _LivePowerPainter(
          samples: samples,
          sessionStartedAt: sessionStartedAt,
          now: DateTime.now(),
          color: AppColors.green,
          gridColor: AppColors.border,
          labelColor: AppColors.muted,
        ),
      ),
    );
  }
}

/// Historical power chart used by the analysis page.
class PowerHistoryLineChart extends StatelessWidget {
  final List<Offset2> points;

  PowerHistoryLineChart({super.key, required this.points});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 130,
      width: double.infinity,
      child: CustomPaint(
        painter: SmoothLinePainter(
          points: points,
          viewBox: Size(330, 130),
          color: AppColors.green,
          fill: true,
        ),
      ),
    );
  }
}

class _LivePowerPainter extends CustomPainter {
  final List<PowerSample> samples;
  final DateTime sessionStartedAt;
  final DateTime now;
  final Color color;
  final Color gridColor;
  final Color labelColor;

  _LivePowerPainter({
    required this.samples,
    required this.sessionStartedAt,
    required this.now,
    required this.color,
    required this.gridColor,
    required this.labelColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    const left = 44.0;
    const top = 12.0;
    const rightInset = 10.0;
    const bottomInset = 28.0;
    final plot = Rect.fromLTRB(
      left,
      top,
      size.width - rightInset,
      size.height - bottomInset,
    );
    if (plot.width <= 0 || plot.height <= 0) return;

    final peak = samples.fold<double>(
      0,
      (highest, sample) => math.max(highest, sample.powerWatts),
    );
    final scaleMax = _niceMax(peak);
    final gridPaint = Paint()
      ..color = gridColor.withValues(alpha: .55)
      ..strokeWidth = 1;
    for (var tick = 0; tick <= 4; tick++) {
      final ratio = tick / 4;
      final y = plot.bottom - ratio * plot.height;
      canvas.drawLine(Offset(plot.left, y), Offset(plot.right, y), gridPaint);
      _drawLabel(
        canvas,
        _formatTick(scaleMax * ratio),
        Offset(0, y - 7),
        maxWidth: left - 7,
        alignRight: true,
      );
    }

    _drawLabel(canvas, 'OPEN', Offset(plot.left, plot.bottom + 8));
    _drawLabel(
      canvas,
      'NOW',
      Offset(plot.right - 28, plot.bottom + 8),
    );

    if (samples.isEmpty) return;

    final elapsed = math.max(
      0.001,
      now.difference(sessionStartedAt).inMicroseconds / 1000000,
    );
    final points = samples.map((sample) {
      final seconds =
          sample.observedAt.difference(sessionStartedAt).inMicroseconds /
              1000000;
      final x = plot.left + (seconds / elapsed).clamp(0.0, 1.0) * plot.width;
      final y = plot.bottom -
          (sample.powerWatts / scaleMax).clamp(0.0, 1.0) * plot.height;
      return Offset(x, y);
    }).toList();

    if (points.length == 1) {
      canvas.drawCircle(
        points.single,
        4,
        Paint()..color = color,
      );
      return;
    }

    final line = Path()..moveTo(points.first.dx, points.first.dy);
    for (var i = 1; i < points.length - 1; i++) {
      final midpoint = Offset(
        (points[i].dx + points[i + 1].dx) / 2,
        (points[i].dy + points[i + 1].dy) / 2,
      );
      line.quadraticBezierTo(
          points[i].dx, points[i].dy, midpoint.dx, midpoint.dy);
    }
    line.lineTo(points.last.dx, points.last.dy);

    final area = Path.from(line)
      ..lineTo(points.last.dx, plot.bottom)
      ..lineTo(points.first.dx, plot.bottom)
      ..close();
    canvas.drawPath(
      area,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [color.withValues(alpha: .28), color.withValues(alpha: .01)],
        ).createShader(plot),
    );
    canvas.drawPath(
      line,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.8
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
    canvas.drawCircle(points.last, 4, Paint()..color = color);
    canvas.drawCircle(
      points.last,
      8,
      Paint()..color = color.withValues(alpha: .18),
    );
  }

  double _niceMax(double value) {
    if (value <= 0) return 10;
    final magnitude =
        math.pow(10, (math.log(value) / math.ln10).floor()).toDouble();
    final normalized = value / magnitude;
    final nice = normalized <= 1
        ? 1
        : normalized <= 2
            ? 2
            : normalized <= 5
                ? 5
                : 10;
    return nice * magnitude;
  }

  String _formatTick(double value) => value >= 1000
      ? '${(value / 1000).toStringAsFixed(value % 1000 == 0 ? 0 : 1)}k'
      : value.toStringAsFixed(value < 10 ? 1 : 0);

  void _drawLabel(
    Canvas canvas,
    String text,
    Offset offset, {
    double maxWidth = double.infinity,
    bool alignRight = false,
  }) {
    final painter = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(
          color: labelColor,
          fontSize: 9,
          fontWeight: FontWeight.w500,
        ),
      ),
      textDirection: TextDirection.ltr,
      maxLines: 1,
    )..layout(maxWidth: maxWidth);
    painter.paint(
      canvas,
      Offset(alignRight ? offset.dx + maxWidth - painter.width : offset.dx,
          offset.dy),
    );
  }

  @override
  bool shouldRepaint(covariant _LivePowerPainter old) =>
      old.samples != samples ||
      old.sessionStartedAt != sessionStartedAt ||
      old.now != now ||
      old.color != color ||
      old.gridColor != gridColor ||
      old.labelColor != labelColor;
}

/// Two-line chart (Analysis -> Actual vs expected).
class ComparisonChart extends StatelessWidget {
  final List<Offset2> actual;
  final List<Offset2> expected;
  ComparisonChart({super.key, required this.actual, required this.expected});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 115,
      width: double.infinity,
      child: Stack(
        fit: StackFit.expand,
        children: [
          CustomPaint(
            painter: SmoothLinePainter(
              points: expected,
              viewBox: Size(330, 115),
              color: AppColors.muted,
              strokeWidth: 2,
            ),
          ),
          CustomPaint(
            painter: SmoothLinePainter(
              points: actual,
              viewBox: Size(330, 115),
              color: AppColors.cyan,
              strokeWidth: 3,
            ),
          ),
        ],
      ),
    );
  }
}
