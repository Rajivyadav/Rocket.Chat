import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import React, { useMemo, useState } from 'react';
import toastr from 'toastr';

import { call } from '../../../../app/ui-utils/client';
import { handleError } from '../../../../app/utils/client';
import { callbacks } from '../../../../app/callbacks/client';
import { useSetting } from '../../../hooks/useSetting';
import { useTranslation } from '../../../hooks/useTranslation';
import { Input } from '../../basic/Input';
import { useSetupWizardStepsState } from '../StepsState';
import { Step } from '../Step';
import { StepHeader } from '../StepHeader';
import { Pager } from '../Pager';
import { StepContent } from '../StepContent';

// TODO: move it to its own helper module
const loginWithPassword = (email, password) => new Promise((resolve, reject) => {
	Meteor.loginWithPassword(email, password, (error) => {
		if (error) {
			reject(error);
			return;
		}

		resolve();
	});
});

const registerAdminUser = async ({ name, username, email, password, onRegistrationEmailSent }) => {
	await call('registerUser', { name, username, email, pass: password });
	callbacks.run('userRegistered');

	try {
		await loginWithPassword(email, password);
	} catch (error) {
		if (error.error === 'error-invalid-email') {
			onRegistrationEmailSent && onRegistrationEmailSent();
			return;
		}

		throw error;
	}

	Session.set('forceLogin', false);

	await call('setUsername', username);

	callbacks.run('usernameSet');
};

export function AdminUserInformationStep({ step, title }) {
	const { currentStep, goToNextStep } = useSetupWizardStepsState();
	const active = step === currentStep;

	const regexpForUsernameValidation = useSetting('UTF8_Names_Validation');
	const usernameRegExp = useMemo(() => new RegExp(`^${ regexpForUsernameValidation }$`), [regexpForUsernameValidation]);
	const emailRegExp = useMemo(() => /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]+$/i, []);

	const [name, setName] = useState('');
	const [username, setUsername] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');

	const [isNameValid, validateName] = useState(true);
	const [isUsernameValid, validateUsername] = useState(true);
	const [isEmailValid, validateEmail] = useState(true);
	const [isPasswordValid, validatePassword] = useState(true);

	const isContinueEnabled = useMemo(() => name && username && email && password, [name, username, email, password]);

	const [commiting, setCommiting] = useState(false);

	const validate = () => {
		const isNameValid = !!name;
		const isUsernameValid = !!username && usernameRegExp.test(username);
		const isEmailValid = !!email && emailRegExp.test(email);
		const isPasswordValid = !!password;

		validateName(isNameValid);
		validateUsername(isUsernameValid);
		validateEmail(isEmailValid);
		validatePassword(isPasswordValid);

		return isNameValid && isUsernameValid && isEmailValid && isPasswordValid;
	};

	const t = useTranslation();

	const handleContinueClick = async () => {
		const canRegisterAdminUser = validate();

		if (!canRegisterAdminUser) {
			return;
		}

		setCommiting(true);

		try {
			await registerAdminUser({
				name,
				username,
				email,
				password,
				onRegistrationEmailSent: () => toastr.success(t('We_have_sent_registration_email')),
			});
			goToNextStep();
		} catch (error) {
			console.error(error);
			handleError(error);
		} finally {
			setCommiting(false);
		}
	};

	return <Step active={active} working={commiting}>
		<StepHeader number={step} title={title} />

		<StepContent>
			<Input
				title={t('Name')}
				type='text'
				icon='user'
				placeholder={t('Type_your_name')}
				value={name}
				onChange={({ currentTarget: { value } }) => setName(value)}
				error={!isNameValid}
			/>
			<Input
				title={t('Username')}
				type='text'
				icon='at'
				placeholder={t('Type_your_username')}
				value={username}
				onChange={({ currentTarget: { value } }) => setUsername(value)}
				error={!isUsernameValid && t('Invalid_username')}
			/>
			<Input
				title={t('Organization_Email')}
				type='email'
				icon='mail'
				placeholder={t('Type_your_email')}
				value={email}
				onChange={({ currentTarget: { value } }) => setEmail(value)}
				error={!isEmailValid && t('Invalid_email')}
			/>
			<Input
				title={t('Password')}
				type='password'
				icon='key'
				placeholder={t('Type_your_password')}
				value={password}
				onChange={({ currentTarget: { value } }) => setPassword(value)}
				error={!isPasswordValid}
			/>
		</StepContent>

		<Pager disabled={commiting} onContinueClick={isContinueEnabled && handleContinueClick} />
	</Step>;
}