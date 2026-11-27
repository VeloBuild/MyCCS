import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  canManageDepartmentInfo,
  DepartmentInfoCreateInputSchema,
  DepartmentInfoUpdateInputSchema,
  type DepartmentInfo,
  type DepartmentInfoCreateInput,
  type DepartmentInfoUpdateInput,
  type DepartmentLeadershipEntry,
  type RbacActor,
} from '../../shared/core-schema';
import {
  formatManilaDate,
  normalizeDepartmentContacts,
} from '../../shared/dept-org';
import {
  CCS_CREST_COLORS,
  CCS_CREST_RADII,
  CCS_CREST_SIZES,
  CCS_CREST_SPACING,
} from '../theme/ccsCrest';

export interface DepartmentAboutViewProps {
  departmentInfo: DepartmentInfo | null;
  actor: RbacActor;
  mode: 'view' | 'edit';
  busy?: boolean;
  onEnterEdit: () => void;
  onCancelEdit: () => void;
  onCreate: (input: DepartmentInfoCreateInput) => Promise<void>;
  onSave: (id: string, input: DepartmentInfoUpdateInput) => Promise<void>;
}

function escapeLeadershipField(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

function unescapeLeadershipField(rawField: string): string {
  let result = '';
  for (let i = 0; i < rawField.length; i += 1) {
    const ch = rawField[i];
    if (ch === '\\' && i + 1 < rawField.length) {
      const next = rawField[i + 1];
      if (next === '\\' || next === '|') {
        result += next;
        i += 1;
        continue;
      }
      if (next === 'r') {
        result += '\r';
        i += 1;
        continue;
      }
      if (next === 'n') {
        result += '\n';
        i += 1;
        continue;
      }
    }
    result += ch;
  }
  return result;
}

function splitLeadershipFields(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let escaping = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (escaping) {
      current += ch;
      escaping = false;
      continue;
    }
    if (ch === '\\') {
      current += ch;
      escaping = true;
      continue;
    }
    if (ch === '|') {
      fields.push(current);
      current = '';
      continue;
    }
    current += ch;
  }

  fields.push(current);
  return fields;
}

export function formatLeadershipLines(
  entries: readonly DepartmentLeadershipEntry[]
): string {
  return entries
    .map((entry) => {
      const name = escapeLeadershipField(entry.name);
      const title = escapeLeadershipField(entry.title);
      return entry.email
        ? `${name} | ${title} | ${escapeLeadershipField(entry.email)}`
        : `${name} | ${title}`;
    })
    .join('\n');
}

export function parseLeadershipLines(raw: string): DepartmentLeadershipEntry[] {
  const entries: DepartmentLeadershipEntry[] = [];
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0) {
      continue;
    }

    const parts = splitLeadershipFields(line).map((part) =>
      unescapeLeadershipField(part.trim())
    );
    const [name = '', title = '', email = ''] = parts;
    if (
      parts.length < 2 ||
      parts.length > 3 ||
      name.trim().length === 0 ||
      title.trim().length === 0
    ) {
      throw new Error(
        'Each leadership line must use "Name | Title" or "Name | Title | email".'
      );
    }

    entries.push(
      email.trim().length > 0 ? { name, title, email } : { name, title }
    );
  }
  return entries;
}

function readContactString(
  contactJson: Record<string, unknown>,
  key: string
): string {
  const value = contactJson[key];
  return typeof value === 'string' ? value : '';
}

interface DepartmentEditFormProps {
  departmentInfo: DepartmentInfo | null;
  busy: boolean;
  onCancelEdit: () => void;
  onCreate: (input: DepartmentInfoCreateInput) => Promise<void>;
  onSave: (id: string, input: DepartmentInfoUpdateInput) => Promise<void>;
}

function DepartmentEditForm({
  departmentInfo,
  busy,
  onCancelEdit,
  onCreate,
  onSave,
}: DepartmentEditFormProps) {
  const [title, setTitle] = useState(departmentInfo?.title ?? '');
  const [aboutMarkdown, setAboutMarkdown] = useState(
    departmentInfo?.about_markdown ?? ''
  );
  const [contactOffice, setContactOffice] = useState(
    departmentInfo ? readContactString(departmentInfo.contact_json, 'office') : ''
  );
  const [officeDirty, setOfficeDirty] = useState(false);
  const [contactEmail, setContactEmail] = useState(
    departmentInfo ? readContactString(departmentInfo.contact_json, 'email') : ''
  );
  const [emailDirty, setEmailDirty] = useState(false);
  const [leadershipText, setLeadershipText] = useState(
    departmentInfo ? formatLeadershipLines(departmentInfo.leadership_json) : ''
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const submittingRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isCreating = departmentInfo === null;

  const handleSubmit = async () => {
    if (busy || submittingRef.current) {
      return;
    }

    setValidationError(null);

    let leadershipEntries: DepartmentLeadershipEntry[];
    try {
      leadershipEntries = parseLeadershipLines(leadershipText);
    } catch (err) {
      setValidationError(
        err instanceof Error ? err.message : 'Invalid leadership entries.'
      );
      return;
    }

    const nextContacts: Record<string, unknown> = departmentInfo
      ? { ...departmentInfo.contact_json }
      : {};
    const trimmedOffice = contactOffice.trim();
    const trimmedEmail = contactEmail.trim();
    if (officeDirty || (isCreating && trimmedOffice.length > 0)) {
      if (trimmedOffice.length > 0) {
        nextContacts.office = trimmedOffice;
      } else {
        delete nextContacts.office;
      }
    }
    if (emailDirty || (isCreating && trimmedEmail.length > 0)) {
      if (trimmedEmail.length > 0) {
        nextContacts.email = trimmedEmail;
      } else {
        delete nextContacts.email;
      }
    }

    const rawPayload = {
      title,
      about_markdown: aboutMarkdown,
      leadership_json: leadershipEntries,
      contact_json: nextContacts,
    };

    if (isCreating) {
      const parsed = DepartmentInfoCreateInputSchema.safeParse(rawPayload);
      if (!parsed.success) {
        setValidationError(
          parsed.error.issues[0]?.message ?? 'Invalid department details.'
        );
        return;
      }

      submittingRef.current = true;
      try {
        await onCreate(parsed.data);
      } catch (err) {
        if (mountedRef.current) {
          setValidationError(
            err instanceof Error
              ? err.message
              : 'Failed to create department info.'
          );
        }
      } finally {
        submittingRef.current = false;
      }
      return;
    }

    const parsed = DepartmentInfoUpdateInputSchema.safeParse(rawPayload);
    if (!parsed.success) {
      setValidationError(
        parsed.error.issues[0]?.message ?? 'Invalid department details.'
      );
      return;
    }

    submittingRef.current = true;
    try {
      await onSave(departmentInfo.id, parsed.data);
    } catch (err) {
      if (mountedRef.current) {
        setValidationError(
          err instanceof Error ? err.message : 'Failed to save department info.'
        );
      }
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.sheet} testID="department-edit-form">
        <Text style={styles.headline}>
          {isCreating ? 'Add Department Info' : 'Edit Department Info'}
        </Text>

        <Text style={styles.fieldLabel}>Department Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="College of Information Technology and Computer Science"
          testID="dept-edit-title-input"
        />

        <Text style={styles.fieldLabel}>About Overview</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          value={aboutMarkdown}
          onChangeText={setAboutMarkdown}
          multiline
          placeholder="Department mission, programs, and office notes"
          testID="dept-edit-about-input"
        />

        <Text style={styles.fieldLabel}>Office Location</Text>
        <TextInput
          style={styles.input}
          value={contactOffice}
          onChangeText={(value) => {
            setOfficeDirty(true);
            setContactOffice(value);
          }}
          placeholder="CCS Faculty Room, 3F"
          testID="dept-edit-office-input"
        />

        <Text style={styles.fieldLabel}>Contact Email</Text>
        <TextInput
          style={styles.input}
          value={contactEmail}
          onChangeText={(value) => {
            setEmailDirty(true);
            setContactEmail(value);
          }}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="ccs@lpunetwork.edu.ph"
          testID="dept-edit-email-input"
        />

        <Text style={styles.fieldLabel}>
          Leadership Directory (Name | Title | email per line)
        </Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          value={leadershipText}
          onChangeText={setLeadershipText}
          multiline
          placeholder="Dr. Maria Santos | Dean | maria.santos@lpunetwork.edu.ph"
          testID="dept-edit-leadership-input"
        />

        {validationError ? (
          <Text style={styles.errorText} testID="dept-form-error">
            {validationError}
          </Text>
        ) : null}

        <View style={styles.actionRow}>
          <Pressable
            style={styles.primaryButton}
            onPress={() => void handleSubmit()}
            disabled={busy}
            testID="dept-save-button"
          >
            <Text style={styles.primaryButtonText}>
              {isCreating ? 'Save Department Info' : 'Save Changes'}
            </Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={onCancelEdit}
            disabled={busy}
            testID="dept-cancel-button"
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

export function DepartmentAboutView({
  departmentInfo,
  actor,
  mode,
  busy = false,
  onEnterEdit,
  onCancelEdit,
  onCreate,
  onSave,
}: DepartmentAboutViewProps) {
  const canEdit = canManageDepartmentInfo(actor);

  if (canEdit && mode === 'edit') {
    return (
      <DepartmentEditForm
        key={departmentInfo?.id ?? 'new'}
        departmentInfo={departmentInfo}
        busy={busy}
        onCancelEdit={onCancelEdit}
        onCreate={onCreate}
        onSave={onSave}
      />
    );
  }

  if (!departmentInfo) {
    return (
      <View style={styles.content}>
        <View style={styles.sheet} testID="department-empty-state">
          <Text style={styles.headline}>Department Information</Text>
          <Text style={styles.bodyText}>
            CCS department details have not been published yet.
          </Text>
          {canEdit ? (
            <Pressable
              style={[styles.primaryButton, styles.inlineEditButton]}
              onPress={onEnterEdit}
              disabled={busy}
              testID="dept-create-button"
            >
              <Text style={styles.primaryButtonText}>Add Department Info</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  const contacts = normalizeDepartmentContacts(departmentInfo.contact_json);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.sheet} testID="department-about-view">
        <View style={styles.sectionBlock}>
          <Text style={styles.displayTitle} testID="department-title">
            {departmentInfo.title}
          </Text>
          <Text style={styles.metaText}>
            {`Updated ${formatManilaDate(departmentInfo.updated_at)}`}
          </Text>
          {canEdit ? (
            <Pressable
              style={[styles.primaryButton, styles.inlineEditButton]}
              onPress={onEnterEdit}
              disabled={busy}
              testID="dept-edit-button"
            >
              <Text style={styles.primaryButtonText}>Edit Department Info</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.sectionBlock, styles.sectionRule]}>
          <Text style={styles.sectionHeading}>Overview</Text>
          <Text style={styles.bodyText} testID="department-about-body">
            {departmentInfo.about_markdown}
          </Text>
        </View>

        <View style={[styles.sectionBlock, styles.sectionRule]}>
          <Text style={styles.sectionHeading}>Leadership & Faculty</Text>
          {departmentInfo.leadership_json.length === 0 ? (
            <Text style={styles.mutedText}>No leadership entries listed.</Text>
          ) : (
            departmentInfo.leadership_json.map((leader, index) => (
              <View
                key={`${leader.name}-${leader.title}-${index}`}
                style={[styles.ledgerRow, index > 0 && styles.rowRule]}
              >
                <Text style={styles.rowTitle}>{leader.name}</Text>
                <Text style={styles.bodyText}>{leader.title}</Text>
                {leader.email ? (
                  <Text style={styles.mutedText}>{leader.email}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>

        <View style={[styles.sectionBlock, styles.sectionRule]}>
          <Text style={styles.sectionHeading}>Contact Details</Text>
          {contacts.length === 0 ? (
            <Text style={styles.mutedText}>No contact details listed.</Text>
          ) : (
            contacts.map((contact, index) => (
              <View
                key={`${contact.label}-${index}`}
                style={[styles.ledgerRow, index > 0 && styles.rowRule]}
              >
                <Text style={styles.fieldLabel}>{contact.label}</Text>
                <Text style={styles.bodyText}>{contact.value}</Text>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: CCS_CREST_SPACING.xl,
    paddingBottom: CCS_CREST_SPACING.xxl,
  },
  sheet: {
    backgroundColor: CCS_CREST_COLORS.paperWhite,
    borderRadius: CCS_CREST_RADII.lg,
    borderWidth: 1,
    borderColor: CCS_CREST_COLORS.crestRule,
    padding: CCS_CREST_SPACING.lg,
  },
  sectionBlock: {
    paddingVertical: CCS_CREST_SPACING.md,
  },
  sectionRule: {
    borderTopWidth: 1,
    borderTopColor: CCS_CREST_COLORS.crestRule,
  },
  displayTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: CCS_CREST_COLORS.inkPrimary,
    marginBottom: CCS_CREST_SPACING.xs,
  },
  headline: {
    fontSize: 17,
    fontWeight: '700',
    color: CCS_CREST_COLORS.inkPrimary,
    marginBottom: CCS_CREST_SPACING.md,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: CCS_CREST_COLORS.crestNavy,
    marginBottom: CCS_CREST_SPACING.sm,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: CCS_CREST_COLORS.inkPrimary,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 21,
    color: CCS_CREST_COLORS.inkSecondary,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    color: CCS_CREST_COLORS.inkMuted,
  },
  mutedText: {
    fontSize: 13,
    color: CCS_CREST_COLORS.inkMuted,
  },
  ledgerRow: {
    paddingVertical: CCS_CREST_SPACING.sm,
  },
  rowRule: {
    borderTopWidth: 1,
    borderTopColor: CCS_CREST_COLORS.crestRule,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: CCS_CREST_COLORS.inkPrimary,
    marginBottom: CCS_CREST_SPACING.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: CCS_CREST_COLORS.crestRuleStrong,
    borderRadius: CCS_CREST_RADII.md,
    backgroundColor: CCS_CREST_COLORS.paperWhite,
    color: CCS_CREST_COLORS.inkPrimary,
    paddingHorizontal: CCS_CREST_SPACING.md,
    paddingVertical: 10,
    minHeight: CCS_CREST_SIZES.minTouchHeight,
    marginBottom: CCS_CREST_SPACING.md,
  },
  multilineInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  inlineEditButton: {
    marginTop: CCS_CREST_SPACING.md,
    alignSelf: 'flex-start',
  },
  actionRow: {
    flexDirection: 'row',
    gap: CCS_CREST_SPACING.sm,
    marginTop: CCS_CREST_SPACING.sm,
  },
  primaryButton: {
    backgroundColor: CCS_CREST_COLORS.crestNavy,
    borderRadius: CCS_CREST_RADII.pill,
    minHeight: CCS_CREST_SIZES.minTouchHeight,
    paddingHorizontal: CCS_CREST_SPACING.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: CCS_CREST_COLORS.paperWhite,
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryButton: {
    backgroundColor: CCS_CREST_COLORS.paperWhite,
    borderColor: CCS_CREST_COLORS.crestRuleStrong,
    borderWidth: 1,
    borderRadius: CCS_CREST_RADII.pill,
    minHeight: CCS_CREST_SIZES.minTouchHeight,
    paddingHorizontal: CCS_CREST_SPACING.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: CCS_CREST_COLORS.inkPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  errorText: {
    color: CCS_CREST_COLORS.absentCrimson,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: CCS_CREST_SPACING.sm,
  },
});
