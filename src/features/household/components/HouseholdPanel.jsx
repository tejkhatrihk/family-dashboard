import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Tab,
  Tabs,
  TextField,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useFirebaseAuth } from "../../../shared/api/firebaseAuthContext";
import { useHousehold } from "../api/householdContext";

export default function HouseholdPanel({ defaultExpanded = false }) {
  const { user } = useFirebaseAuth();
  const {
    household,
    members,
    inviteMember,
    addManagedMember,
    isOwner,
    updateMember,
  } = useHousehold();
  const [addMode, setAddMode] = useState("email");
  const [email, setEmail] = useState("");
  const [managedName, setManagedName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [invitedEmail, setInvitedEmail] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const currentMember = members.find((member) => member.uid === user.uid);

  const createInvite = async () => {
    const recipientEmail = email.trim();
    setSubmitting(true);
    setError(null);
    setSuccess("");
    try {
      const code = await inviteMember(recipientEmail);
      setInviteCode(code);
      setInvitedEmail(recipientEmail);
      setEmail("");
    } catch (inviteError) {
      setError(inviteError);
    } finally {
      setSubmitting(false);
    }
  };

  const createManagedMember = async () => {
    const displayName = managedName.trim();
    setSubmitting(true);
    setError(null);
    setSuccess("");
    try {
      await addManagedMember(displayName);
      setManagedName("");
      setSuccess(`${displayName} was added to the household.`);
    } catch (addError) {
      setError(addError);
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(inviteCode);
  };

  const openEmailInvite = () => {
    const householdName = household?.name || "our family household";
    const dashboardUrl = `${window.location.origin}${window.location.pathname}`;
    const subject = `You're invited to ${householdName}`;
    const body = [
      "Hi,",
      "",
      `You've been invited to join ${householdName} on Family Dashboard.`,
      "",
      `Invitation code: ${inviteCode}`,
      "",
      `Open ${dashboardUrl} and sign in with ${invitedEmail}.`,
      'Then select "Join household" and enter the invitation code above.',
      "",
      "This invitation is linked to this email address and can only be used once.",
    ].join("\n");
    const mailtoUrl = `mailto:${encodeURIComponent(invitedEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    window.location.assign(mailtoUrl);
  };

  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters
      elevation={0}
      sx={{
        bgcolor: "transparent",
        "&::before": { display: "none" },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls="household-members-content"
        id="household-members-header"
        sx={{
          px: 0,
          minHeight: 48,
          "& .MuiAccordionSummary-content": { my: 0.75 },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <GroupOutlinedIcon color="primary" />
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{household?.name}</Typography>
            <Typography variant="caption" color="text.secondary">{members.length} member{members.length === 1 ? "" : "s"}</Typography>
          </Box>
        </Box>
      </AccordionSummary>

      <AccordionDetails sx={{ px: 0, pt: 0, pb: 0 }}>

      <List dense disablePadding>
        {members.map((member) => (
          <ListItem key={member.uid} disableGutters>
            <ListItemAvatar sx={{ minWidth: 38 }}>
              <Avatar src={member.photoURL} sx={{ width: 28, height: 28, bgcolor: member.color }}>
                {member.displayName?.slice(0, 1)}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={member.displayName}
              secondary={
                member.memberType === "managed"
                  ? "Managed household profile"
                  : member.email
              }
              primaryTypographyProps={{ variant: "body2", fontWeight: 700 }}
              secondaryTypographyProps={{ variant: "caption", noWrap: true }}
            />
            {member.role === "owner" && <Chip label="Owner" size="small" sx={{ height: 21, fontSize: "0.64rem" }} />}
            {member.memberType === "managed" && <Chip label="No login" size="small" sx={{ height: 21, fontSize: "0.64rem" }} />}
            {isOwner && (
              <FormControlLabel
                label="Child"
                sx={{ ml: 0.5, mr: 0 }}
                control={
                  <Switch
                    size="small"
                    checked={Boolean(member.isChild)}
                    inputProps={{
                      "aria-label": `Mark ${member.displayName} as a child`,
                    }}
                    onChange={(event) => {
                      setError(null);
                      updateMember(member.uid, {
                        isChild: event.target.checked,
                      }).catch(setError);
                    }}
                  />
                }
              />
            )}
          </ListItem>
        ))}
      </List>

      {currentMember && (
        <TextField
          key={`${currentMember.uid}-${currentMember.calendarId}`}
          label="Your Google Calendar ID"
          defaultValue={currentMember.calendarId || currentMember.email}
          onBlur={(event) => {
            const calendarId = event.target.value.trim();
            if (calendarId && calendarId !== currentMember.calendarId) {
              updateMember(currentMember.uid, { calendarId }).catch(setError);
            }
          }}
          helperText="Usually your Google email, or the ID of a shared calendar."
          size="small"
          fullWidth
          sx={{ mt: 1 }}
        />
      )}

      {isOwner && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="body2" sx={{ fontWeight: 800 }}>Add family member</Typography>
          <Tabs
            value={addMode}
            onChange={(_, value) => {
              setAddMode(value);
              setError(null);
              setSuccess("");
              setInviteCode("");
              setInvitedEmail("");
            }}
            variant="fullWidth"
            sx={{ mt: 0.5, minHeight: 36, "& .MuiTab-root": { minHeight: 36, py: 0.5, fontSize: "0.75rem" } }}
          >
            <Tab value="email" label="Email invitation" />
            <Tab value="managed" label="Without email" />
          </Tabs>
          {error && <Alert severity="error" sx={{ mt: 1 }}>{error.message}</Alert>}
          {success && <Alert severity="success" sx={{ mt: 1 }}>{success}</Alert>}
          {addMode === "email" ? (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                They will sign in using this exact Google email address.
              </Typography>
              <Box sx={{ display: "flex", gap: 1, mt: 1.25 }}>
                <TextField
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@gmail.com"
                  type="email"
                  size="small"
                  fullWidth
                />
                <Button variant="contained" onClick={createInvite} disabled={!email.includes("@") || submitting}>
                  Invite
                </Button>
              </Box>
              {inviteCode && (
                <Box sx={{ mt: 1.25, p: 1.25, borderRadius: 1, bgcolor: "#e1f2ef" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary">Share this invitation code</Typography>
                    <Typography sx={{ fontWeight: 850, letterSpacing: "0.14em" }}>{inviteCode}</Typography>
                  </Box>
                    <Tooltip title="Copy code"><IconButton onClick={copyCode}><ContentCopyIcon fontSize="small" /></IconButton></Tooltip>
                  </Box>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<EmailOutlinedIcon />}
                    onClick={openEmailInvite}
                    fullWidth
                    sx={{ mt: 1 }}
                  >
                    Email invitation
                  </Button>
                </Box>
              )}
            </>
          ) : (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                Create a profile for a child or anyone who will not sign in independently.
              </Typography>
              <Box sx={{ display: "flex", gap: 1, mt: 1.25 }}>
                <TextField
                  value={managedName}
                  onChange={(event) => setManagedName(event.target.value)}
                  placeholder="Family member name"
                  size="small"
                  fullWidth
                />
                <Button variant="contained" onClick={createManagedMember} disabled={managedName.trim().length < 2 || submitting}>
                  Add
                </Button>
              </Box>
            </>
          )}
        </>
      )}
      </AccordionDetails>
    </Accordion>
  );
}
