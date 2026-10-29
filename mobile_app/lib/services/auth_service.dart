import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../firebase_options.dart';

class AuthService {
  AuthService._();
  static final AuthService instance = AuthService._();

  FirebaseAuth? _auth;
  GoogleSignIn? _googleSignIn;

  bool get isConfigured {
    try {
      DefaultFirebaseOptions.currentPlatform;
      return true;
    } on UnsupportedError {
      return false;
    }
  }
  User? get user => _auth?.currentUser;
  String? get email => user?.email;
  String? get displayName => user?.displayName ?? email;

  Future<void> initialize() async {
    if (!isConfigured) return;
    final options = DefaultFirebaseOptions.currentPlatform;
    final app = Firebase.apps.isEmpty
        ? await Firebase.initializeApp(options: options)
        : Firebase.app();
    _auth = FirebaseAuth.instanceFor(app: app);
    _googleSignIn = GoogleSignIn(
      clientId: defaultTargetPlatform == TargetPlatform.iOS
          ? options.iosClientId
          : null,
    );
  }

  Future<bool> signInWithGoogle() async {
    final auth = _auth;
    final googleSignIn = _googleSignIn;
    if (auth == null || googleSignIn == null) {
      throw StateError('Firebase Google sign-in is not configured.');
    }
    // Present the account chooser on each explicit sign-in, like the web popup.
    await googleSignIn.signOut();
    final googleUser = await googleSignIn.signIn();
    if (googleUser == null) return false;
    final googleAuth = await googleUser.authentication;
    final credential = GoogleAuthProvider.credential(
      accessToken: googleAuth.accessToken,
      idToken: googleAuth.idToken,
    );
    await auth.signInWithCredential(credential);
    return true;
  }

  Future<void> signOut() async {
    await _auth?.signOut();
    await _googleSignIn?.signOut();
  }

  Future<String?> get accessToken async =>
      user == null ? null : await user!.getIdToken();
}
