class OnboardingSlide {
  final String kicker;
  final String titleStart;
  final String titleEmphasis; // rendered italic / highlighted
  final String body;
  final List<String> features;
  final String imageUrl;

  const OnboardingSlide({
    required this.kicker,
    required this.titleStart,
    required this.titleEmphasis,
    required this.body,
    required this.features,
    required this.imageUrl,
  });
}
