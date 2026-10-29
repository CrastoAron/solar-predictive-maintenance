import 'package:flutter/material.dart';
import '../models/onboarding_slide.dart';
import '../services/auth_service.dart';
import '../services/solar_data_service.dart';
import '../theme/app_colors.dart';
import '../widgets/primary_button.dart';

class OnboardingScreen extends StatefulWidget {
  final VoidCallback onComplete;
  OnboardingScreen({super.key, required this.onComplete});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _slides = SolarDataService.instance.onboardingSlides;
  final _controller = PageController();
  int _index = 0;
  bool _loading = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _next() async {
    if (_index < _slides.length - 1) {
      _controller.nextPage(
          duration: Duration(milliseconds: 350), curve: Curves.easeOut);
      return;
    }
    if (AuthService.instance.isConfigured) {
      setState(() => _loading = true);
      try {
        final signedIn = await AuthService.instance.signInWithGoogle();
        if (signedIn && mounted) widget.onComplete();
      } catch (error) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Google sign-in failed: $error')),
          );
        }
      } finally {
        if (mounted) setState(() => _loading = false);
      }
      return;
    }
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Google sign-in is not configured for this build.'),
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLast = _index == _slides.length - 1;
    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          AnimatedSwitcher(
            duration: Duration(milliseconds: 500),
            child: SizedBox.expand(
              key: ValueKey(_index),
              child: Image.network(
                _slides[_index].imageUrl,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) =>
                    ColoredBox(color: AppColors.surface2),
              ),
            ),
          ),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  AppColors.bg.withValues(alpha: .35),
                  AppColors.bg.withValues(alpha: .65),
                  AppColors.bg.withValues(alpha: .97),
                ],
                stops: [0, .45, 1],
              ),
            ),
          ),
          SafeArea(
            child: Column(
              children: [
                Padding(
                  padding: EdgeInsets.fromLTRB(24, 20, 24, 0),
                  child: _Brand(),
                ),
                Expanded(
                  child: PageView.builder(
                    controller: _controller,
                    itemCount: _slides.length,
                    onPageChanged: (i) => setState(() => _index = i),
                    itemBuilder: (_, i) => _SlideCopy(slide: _slides[i]),
                  ),
                ),
                Padding(
                  padding: EdgeInsets.fromLTRB(24, 0, 24, 20),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          for (var i = 0; i < _slides.length; i++)
                            GestureDetector(
                              onTap: () => _controller.animateToPage(i,
                                  duration: Duration(milliseconds: 350),
                                  curve: Curves.easeOut),
                              child: AnimatedContainer(
                                duration: Duration(milliseconds: 250),
                                margin: EdgeInsets.symmetric(horizontal: 4),
                                width: i == _index ? 24 : 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(8),
                                  color: i == _index
                                      ? AppColors.cyan
                                      : Colors.white.withValues(alpha: .3),
                                ),
                              ),
                            ),
                        ],
                      ),
                      SizedBox(height: 18),
                      PrimaryButton(
                        onPressed: _loading ? null : _next,
                        child: isLast
                            ? Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  _GoogleMark(),
                                  SizedBox(width: 10),
                                  Text(_loading
                                      ? 'Connecting…'
                                      : 'Sign in with Google'),
                                ],
                              )
                            : Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text('Continue'),
                                  SizedBox(width: 8),
                                  Icon(Icons.arrow_forward_rounded, size: 20),
                                ],
                              ),
                      ),
                      SizedBox(height: 10),
                      Text(
                        isLast
                            ? AuthService.instance.isConfigured
                                ? 'Sign in with your Google account.'
                                : 'Sign-in is unavailable until Firebase is configured.'
                            : 'Swipe to explore',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: AppColors.muted, fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Brand extends StatelessWidget {
  _Brand();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 30,
          height: 30,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(9),
            gradient: LinearGradient(colors: [AppColors.blue, AppColors.cyan]),
          ),
          child: Icon(Icons.wb_sunny_outlined, size: 18, color: Colors.white),
        ),
        SizedBox(width: 10),
        Text('SOLARSHIELD',
            style: TextStyle(
                fontWeight: FontWeight.w800, letterSpacing: 2, fontSize: 13)),
      ],
    );
  }
}

class _SlideCopy extends StatelessWidget {
  final OnboardingSlide slide;
  _SlideCopy({required this.slide});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.end,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(slide.kicker.toUpperCase(),
              style: TextStyle(
                  color: AppColors.cyan,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.4)),
          SizedBox(height: 12),
          Text.rich(
            TextSpan(
              style: TextStyle(
                  fontSize: 34,
                  fontWeight: FontWeight.w800,
                  height: 1.1,
                  letterSpacing: -1),
              children: [
                TextSpan(text: slide.titleStart),
                TextSpan(
                  text: slide.titleEmphasis,
                  style: TextStyle(
                      fontStyle: FontStyle.italic, color: AppColors.green),
                ),
              ],
            ),
          ),
          SizedBox(height: 14),
          Text(slide.body,
              style: TextStyle(
                  color: AppColors.muted, fontSize: 14, height: 1.55)),
          SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final f in slide.features)
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: .08),
                    borderRadius: BorderRadius.circular(999),
                    border:
                        Border.all(color: Colors.white.withValues(alpha: .12)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.check_rounded,
                          size: 13, color: AppColors.green),
                      SizedBox(width: 5),
                      Text(f,
                          style: TextStyle(
                              fontSize: 11, fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
            ],
          ),
          SizedBox(height: 24),
        ],
      ),
    );
  }
}

class _GoogleMark extends StatelessWidget {
  _GoogleMark();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 24,
      height: 24,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle),
      child: Text('G',
          style: TextStyle(
              color: Color(0xFF4285F4),
              fontWeight: FontWeight.w900,
              fontSize: 14)),
    );
  }
}
