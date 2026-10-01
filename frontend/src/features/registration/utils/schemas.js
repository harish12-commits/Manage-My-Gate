import * as yup from 'yup'

export const step1Schema = yup.object().shape({
  username: yup.string().required('Username is required'),
  email: yup.string().email('Invalid email address').required('Email is required'),
  phone: yup.string().required('Phone number is required'),
  totalUnits: yup
    .number()
    .typeError('Total units must be a number')
    .positive('Total units must be a positive number')
    .integer('Total units must be an integer')
    .required('Total units is required'),
})

export const step2Schema = yup.object().shape({
  organizationName: yup.string().required('Organization name is required'),
})

export const step3Schema = yup.object().shape({
  selectedFeatures: yup.array().of(yup.string()).min(1, 'Please select at least one feature'),
})
