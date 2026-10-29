import 'package:flutter/material.dart';
import '../models/service_models.dart';
import '../services/service_request_service.dart';
import '../services/solar_data_service.dart';
import '../theme/app_colors.dart';
import '../utils/date_format.dart';
import '../widgets/app_badge.dart';
import '../widgets/app_card.dart';
import '../widgets/icon_tile.dart';
import '../widgets/page_header.dart';
import '../widgets/primary_button.dart';
import '../widgets/screen_body.dart';

class ServiceScreen extends StatefulWidget {
  ServiceScreen({super.key});

  @override
  State<ServiceScreen> createState() => _ServiceScreenState();
}

class _ServiceScreenState extends State<ServiceScreen> {
  final _data = SolarDataService.instance;
  final _detailsController = TextEditingController();

  bool _historyTab = false;
  bool _submitted = false;
  bool _submitting = false;
  String? _submitError;
  late String _type = _data.serviceTypes.first;
  DateTime? _date;
  TimeOfDay? _time;
  List<ServiceRequest> _saved = [];

  @override
  void initState() {
    super.initState();
    _loadSaved();
  }

  @override
  void dispose() {
    _detailsController.dispose();
    super.dispose();
  }

  Future<void> _loadSaved() async {
    final list = await ServiceRequestService.instance.getRequests();
    if (mounted) setState(() => _saved = list);
  }

  Future<void> _submit() async {
    if (_submitting || _submitted) return;
    setState(() {
      _submitting = true;
      _submitError = null;
    });
    try {
      await ServiceRequestService.instance.submitRequest(ServiceRequest(
        type: _type,
        preferredDate: _date?.toUtc().toIso8601String(),
        preferredTime: _time?.format(context),
        details: _detailsController.text.trim(),
        createdAt: DateTime.now(),
      ));
      if (!mounted) return;
      setState(() {
        _submitted = true;
        _submitting = false;
      });
      await _data.refreshFromBackend();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _submitError = error.toString();
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _data,
      builder: (context, _) => ScreenBody(children: [
        PageHeader(
            title: 'Service & maintenance',
            subtitle: 'Care for your installation'),
        _tabs(),
        SizedBox(height: 14),
        if (_historyTab) ..._history() else ..._request(),
      ]),
    );
  }

  Widget _tabs() {
    Widget tab(String label, bool active, VoidCallback onTap) => Expanded(
          child: GestureDetector(
            onTap: onTap,
            child: AnimatedContainer(
              duration: Duration(milliseconds: 200),
              padding: EdgeInsets.symmetric(vertical: 12),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(11),
                color: active ? AppColors.blue : Colors.transparent,
              ),
              child: Text(label,
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: active ? Colors.white : AppColors.muted)),
            ),
          ),
        );
    return Container(
      padding: EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(15),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(children: [
        tab('Request service', !_historyTab,
            () => setState(() => _historyTab = false)),
        tab('History', _historyTab, () => setState(() => _historyTab = true)),
      ]),
    );
  }

  List<Widget> _request() {
    final plan = _data.getMaintenancePlan();
    final recommendation = plan.isEmpty ? null : plan.first;
    return [
      AppCard(
        padding: EdgeInsets.all(16),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          IconTile(icon: Icons.build_outlined, color: AppColors.amber),
          SizedBox(width: 12),
          Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              AppBadge(
                _data.backendConnected ? 'Backend guidance' : 'Unavailable',
                tone: BadgeTone.warn,
              ),
              SizedBox(height: 8),
              Text(recommendation?.title ?? 'Maintenance guidance unavailable',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
              SizedBox(height: 4),
              Text(
                  recommendation?.subtitle ??
                      'You can still submit a service request. A maintenance plan will appear here when backend guidance is available.',
                  style: TextStyle(
                      color: AppColors.muted, fontSize: 12, height: 1.5)),
            ]),
          ),
        ]),
      ),
      SizedBox(height: 22),
      SectionTitle('Request service'),
      AppCard(
        padding: EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _label('Service type'),
          _field(
            DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _type,
                isExpanded: true,
                dropdownColor: AppColors.surface2,
                items: [
                  for (final t in _data.serviceTypes)
                    DropdownMenuItem(value: t, child: Text(t)),
                ],
                onChanged: (v) => setState(() => _type = v ?? _type),
              ),
            ),
          ),
          SizedBox(height: 14),
          Row(children: [
            Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _label('Preferred date'),
                    _field(
                      InkWell(
                        onTap: _pickDate,
                        child: Padding(
                          padding: EdgeInsets.symmetric(vertical: 14),
                          child: Text(
                            _date == null
                                ? 'Select date'
                                : formatShortDate(_date!),
                            style: TextStyle(
                                color: _date == null
                                    ? AppColors.muted
                                    : AppColors.text),
                          ),
                        ),
                      ),
                    ),
                  ]),
            ),
            SizedBox(width: 10),
            Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _label('Time'),
                    _field(
                      InkWell(
                        onTap: _pickTime,
                        child: Padding(
                          padding: EdgeInsets.symmetric(vertical: 14),
                          child: Text(
                            _time == null
                                ? 'Select time'
                                : _time!.format(context),
                            style: TextStyle(
                                color: _time == null
                                    ? AppColors.muted
                                    : AppColors.text),
                          ),
                        ),
                      ),
                    ),
                  ]),
            ),
          ]),
          SizedBox(height: 14),
          Row(children: [
            _label('Details'),
            SizedBox(width: 6),
            Padding(
              padding: EdgeInsets.only(bottom: 6),
              child: Text('Optional',
                  style: TextStyle(color: AppColors.muted, fontSize: 10)),
            ),
          ]),
          _field(
            TextField(
              controller: _detailsController,
              maxLines: 3,
              decoration: InputDecoration(
                border: InputBorder.none,
                hintText: 'Describe what you need help with…',
                hintStyle: TextStyle(color: AppColors.muted),
              ),
            ),
          ),
          SizedBox(height: 16),
          PrimaryButton(
            onPressed: _submitting || _submitted ? null : _submit,
            child: _submitting
                ? Row(mainAxisSize: MainAxisSize.min, children: [
                    SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    ),
                    SizedBox(width: 9),
                    Text('Sending request…'),
                  ])
                : _submitted
                    ? Row(mainAxisSize: MainAxisSize.min, children: [
                        Icon(Icons.check_rounded, size: 20),
                        SizedBox(width: 8),
                        Text('Request sent'),
                      ])
                    : Text('Create service request'),
          ),
          if (_submitError != null)
            Padding(
              padding: EdgeInsets.only(top: 10),
              child: Text(
                'Could not send request: $_submitError',
                style: TextStyle(color: AppColors.red, fontSize: 11),
              ),
            ),
          if (_submitted)
            Padding(
              padding: EdgeInsets.only(top: 10),
              child: Text(
                'Your service request was received by the backend.',
                style: TextStyle(color: AppColors.muted, fontSize: 11),
              ),
            ),
        ]),
      ),
      SizedBox(height: 22),
      SectionTitle('Maintenance plan'),
      AppCard(
        padding: EdgeInsets.all(16),
        child: Column(children: [
          if (plan.isEmpty)
            Padding(
              padding: EdgeInsets.all(12),
              child: Text('No maintenance plan is available from the backend.',
                  style: TextStyle(color: AppColors.muted)),
            ),
          for (var i = 0; i < plan.length; i++) ...[
            if (i > 0) SizedBox(height: 16),
            _timelineRow(plan[i]),
          ],
        ]),
      ),
    ];
  }

  List<Widget> _history() {
    final records = _data.getServiceHistory();
    return [
      SplitHeading(
        'Service history',
        trailing:
            _data.hasBackendServiceHistory ? 'Backend records' : 'Unavailable',
      ),
      AppCard(
        padding: EdgeInsets.all(16),
        child: Column(children: [
          if (_saved.isEmpty && records.isEmpty)
            Padding(
              padding: EdgeInsets.all(12),
              child: Text('No service history is available.',
                  style: TextStyle(color: AppColors.muted)),
            ),
          for (final r in _saved) ...[
            _historyRow(
              icon: Icons.schedule_rounded,
              title: r.type,
              subtitle:
                  'Requested ${formatShortDate(r.createdAt)}${r.preferredDate != null ? ' · for ${r.preferredDate}' : ''}',
              body: r.details.isEmpty ? 'No additional details.' : r.details,
              badge: AppBadge('Saved locally', tone: BadgeTone.info),
            ),
            SizedBox(height: 16),
          ],
          for (var i = 0; i < records.length; i++) ...[
            if (i > 0) SizedBox(height: 16),
            _historyRow(
              icon: i == 0 ? Icons.check_rounded : Icons.build_outlined,
              title: records[i].title,
              subtitle: records[i].dateLabel,
              body: records[i].description,
              badge: AppBadge(
                records[i].completed ? 'Completed' : 'Scheduled',
                tone: records[i].completed ? BadgeTone.good : BadgeTone.info,
              ),
            ),
          ],
        ]),
      ),
      Padding(
        padding: EdgeInsets.only(top: 12, left: 2),
        child: Text(
          _data.hasBackendServiceHistory
              ? 'Service history provided by your connected account.'
              : 'Backend service history is unavailable. Requests saved on this device are shown above.',
          style: TextStyle(color: AppColors.muted, fontSize: 11, height: 1.5),
        ),
      ),
    ];
  }

  Widget _historyRow({
    required IconData icon,
    required String title,
    required String subtitle,
    required String body,
    required Widget badge,
  }) {
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      IconTile(icon: icon),
      SizedBox(width: 12),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: TextStyle(fontWeight: FontWeight.w700)),
          SizedBox(height: 3),
          Text(subtitle,
              style: TextStyle(color: AppColors.muted, fontSize: 10)),
          SizedBox(height: 6),
          Text(body,
              style:
                  TextStyle(color: AppColors.muted, fontSize: 12, height: 1.4)),
        ]),
      ),
      SizedBox(width: 8),
      badge,
    ]);
  }

  Widget _timelineRow(MaintenanceTask t) {
    final done = t.state == MaintenanceState.done;
    final icon = done
        ? Icons.check_rounded
        : t.state == MaintenanceState.upcoming
            ? Icons.schedule_rounded
            : Icons.calendar_today_outlined;
    return Row(children: [
      Container(
        width: 30,
        height: 30,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color:
              done ? AppColors.green.withValues(alpha: .15) : AppColors.surface,
          border: Border.all(color: done ? AppColors.green : AppColors.border),
        ),
        child: Icon(icon,
            size: 15, color: done ? AppColors.green : AppColors.muted),
      ),
      SizedBox(width: 12),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(t.title, style: TextStyle(fontWeight: FontWeight.w700)),
          SizedBox(height: 3),
          Text(t.subtitle,
              style: TextStyle(color: AppColors.muted, fontSize: 10)),
        ]),
      ),
    ]);
  }

  Widget _label(String text) => Padding(
        padding: EdgeInsets.only(bottom: 6),
        child: Text(text,
            style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.muted)),
      );

  Widget _field(Widget child) => Container(
        width: double.infinity,
        padding: EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(13),
          border: Border.all(color: AppColors.border),
        ),
        child: child,
      );

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _date ?? now,
      firstDate: now,
      lastDate: now.add(Duration(days: 365)),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _time ?? TimeOfDay.now(),
    );
    if (picked != null) setState(() => _time = picked);
  }
}
