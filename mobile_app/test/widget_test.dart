import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:solarshield/screens/home_screen.dart';
import 'package:solarshield/screens/main_shell.dart';
import 'package:solarshield/screens/onboarding_screen.dart';

/// Wraps a screen in a plain dark MaterialApp (no Google Fonts, so tests
/// don't need network access).
Widget wrap(Widget child) => MaterialApp(
      theme: ThemeData.dark(),
      home: child,
    );

void bigScreen(WidgetTester tester) {
  tester.view.physicalSize = const Size(800, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('Home screen shows system health summary', (tester) async {
    bigScreen(tester);
    await tester.pumpWidget(wrap(const Scaffold(body: HomeScreen())));

    expect(find.text('System healthy'), findsOneWidget);
    expect(find.text('91.2%'), findsOneWidget);
    expect(find.text('Panel health'), findsOneWidget);
    expect(find.text('8 panels online'), findsOneWidget);
  });

  testWidgets('Onboarding advances to the Google sign-in slide', (tester) async {
    bigScreen(tester);
    await tester.pumpWidget(wrap(OnboardingScreen(onComplete: () {})));
    await tester.pump();

    expect(find.text('Continue'), findsOneWidget);
    expect(find.text('Swipe to explore'), findsOneWidget);

    for (var i = 0; i < 3; i++) {
      await tester.drag(find.byType(PageView), const Offset(-600, 0));
      await tester.pumpAndSettle();
    }

    expect(find.text('Sign in with Google'), findsOneWidget);
    expect(find.text('Continue with demo data'), findsOneWidget);
  });

  testWidgets('Bottom navigation switches between tabs', (tester) async {
    bigScreen(tester);
    await tester.pumpWidget(wrap(MainShell(onSignOut: () {})));
    await tester.pump();

    await tester.tap(find.text('Monitoring'));
    await tester.pump();
    expect(find.text('Live monitoring'), findsOneWidget);

    await tester.tap(find.text('Analysis'));
    await tester.pump();
    expect(find.text('Performance analysis'), findsOneWidget);

    await tester.tap(find.text('Service'));
    await tester.pump();
    expect(find.text('Service & maintenance'), findsOneWidget);

    await tester.tap(find.text('Settings'));
    await tester.pump();
    expect(find.text('Account & preferences'), findsOneWidget);
  });

  testWidgets('Analysis range tabs change the energy total', (tester) async {
    bigScreen(tester);
    await tester.pumpWidget(wrap(MainShell(onSignOut: () {})));
    await tester.tap(find.text('Analysis'));
    await tester.pump();

    expect(find.textContaining('2,298'), findsOneWidget);

    await tester.tap(find.text('30D'));
    await tester.pump();
    expect(find.textContaining('9,840'), findsOneWidget);
  });

  testWidgets('Service screen toggles to History tab', (tester) async {
    bigScreen(tester);
    await tester.pumpWidget(wrap(MainShell(onSignOut: () {})));
    await tester.tap(find.text('Service'));
    await tester.pump();

    expect(find.text('Create service request'), findsOneWidget);

    await tester.tap(find.text('History'));
    await tester.pump();
    expect(find.text('Service history'), findsOneWidget);
    expect(find.text('System inspection'), findsWidgets);
  });

  testWidgets('Sign out button calls the callback', (tester) async {
    bigScreen(tester);
    var signedOut = false;
    await tester.pumpWidget(wrap(MainShell(onSignOut: () => signedOut = true)));
    await tester.tap(find.text('Settings'));
    await tester.pump();

    await tester.ensureVisible(find.text('Sign out'));
    await tester.tap(find.text('Sign out'));
    await tester.pump();

    expect(signedOut, isTrue);
  });
}