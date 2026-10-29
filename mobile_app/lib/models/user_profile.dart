class UserProfile {
  final String firstName;
  final String fullName;
  final String note;

  const UserProfile({
    required this.firstName,
    required this.fullName,
    required this.note,
  });

  String get initial => firstName.isEmpty ? '?' : firstName[0].toUpperCase();
}
