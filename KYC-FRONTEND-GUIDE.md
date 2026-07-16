# KYC and Beneficiary Creation - Frontend Implementation Guide

This guide explains how to implement the frontend for the KYC submission and beneficiary creation flow.

## 1. KYC Submission Form

Create a form component to collect KYC details from the user:

```jsx
import React, { useState } from 'react';
import axios from 'axios';

const KYCForm = ({ memberId }) => {
  const [formData, setFormData] = useState({
    ref_no: memberId,
    bankAccount: '',
    ifsc: '',
    pan: '',
    address: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      const response = await axios.post('/kyc/submit', formData);
      setMessage('KYC submitted successfully! Awaiting approval.');
    } catch (error) {
      setMessage('Error submitting KYC: ' + (error.response?.data?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="kyc-form">
      <h2>Submit KYC Details</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Bank Account Number:</label>
          <input
            type="text"
            name="bankAccount"
            value={formData.bankAccount}
            onChange={handleChange}
            required
          />
        </div>
        
        <div>
          <label>IFSC Code:</label>
          <input
            type="text"
            name="ifsc"
            value={formData.ifsc}
            onChange={handleChange}
            required
          />
        </div>
        
        <div>
          <label>PAN Number:</label>
          <input
            type="text"
            name="pan"
            value={formData.pan}
            onChange={handleChange}
            required
          />
        </div>
        
        <div>
          <label>Address:</label>
          <textarea
            name="address"
            value={formData.address}
            onChange={handleChange}
            required
          />
        </div>
        
        <button type="submit" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit KYC'}
        </button>
      </form>
      
      {message && <p>{message}</p>}
    </div>
  );
};

export default KYCForm;
```

## 2. Beneficiary Status Checker

Component to check the status of KYC and beneficiary creation:

```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BeneficiaryStatus = ({ memberId }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/kyc/beneficiary/${memberId}`);
      setStatus(response.data);
    } catch (error) {
      console.error('Error fetching status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (memberId) {
      fetchStatus();
    }
  }, [memberId]);

  const getStatusMessage = () => {
    if (!status) return 'Loading...';
    
    if (status.kycStatus === 'PENDING') {
      return 'KYC Pending Verification';
    }
    
    if (status.kycStatus === 'APPROVED') {
      if (status.beneficiaryStatus === 'CREATED') {
        return 'Account Verified – Ready for Payouts';
      } else {
        return 'KYC Approved – Beneficiary Creating...';
      }
    }
    
    if (status.kycStatus === 'REJECTED') {
      return 'KYC Rejected – Please Contact Support';
    }
    
    return 'Unknown Status';
  };

  return (
    <div className="beneficiary-status">
      <h3>Account Status</h3>
      <p>{getStatusMessage()}</p>
      <button onClick={fetchStatus} disabled={loading}>
        {loading ? 'Refreshing...' : 'Refresh Status'}
      </button>
    </div>
  );
};

export default BeneficiaryStatus;
```

## 3. Payout Initiation Component

Component to initiate payouts to beneficiaries:

```jsx
import React, { useState } from 'react';
import axios from 'axios';

const PayoutForm = ({ memberId }) => {
  const [formData, setFormData] = useState({
    memberId: memberId,
    amount: '',
    transferId: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    // Generate a unique transfer ID if not provided
    const transferData = {
      ...formData,
      transferId: formData.transferId || `TR_${Date.now()}_${Math.floor(Math.random() * 1000)}`
    };
    
    try {
      const response = await axios.post('/kyc/payout', transferData);
      setMessage('Payout initiated successfully!');
    } catch (error) {
      setMessage('Error initiating payout: ' + (error.response?.data?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payout-form">
      <h2>Initiate Payout</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Amount:</label>
          <input
            type="number"
            name="amount"
            value={formData.amount}
            onChange={handleChange}
            required
            min="1"
          />
        </div>
        
        <div>
          <label>Transfer ID (optional):</label>
          <input
            type="text"
            name="transferId"
            value={formData.transferId}
            onChange={handleChange}
          />
        </div>
        
        <button type="submit" disabled={loading}>
          {loading ? 'Processing...' : 'Send Payout'}
        </button>
      </form>
      
      {message && <p>{message}</p>}
    </div>
  );
};

export default PayoutForm;
```

## 4. Integration Example

Example of how to integrate all components in a user dashboard:

```jsx
import React from 'react';
import KYCForm from './KYCForm';
import BeneficiaryStatus from './BeneficiaryStatus';
import PayoutForm from './PayoutForm';

const UserDashboard = ({ memberId }) => {
  return (
    <div className="user-dashboard">
      <h1>User Dashboard</h1>
      
      <section>
        <BeneficiaryStatus memberId={memberId} />
      </section>
      
      <section>
        <KYCForm memberId={memberId} />
      </section>
      
      <section>
        <PayoutForm memberId={memberId} />
      </section>
    </div>
  );
};

export default UserDashboard;
```

## 5. API Endpoints

The frontend should interact with the following backend endpoints:

1. **Submit KYC**: `POST /kyc/submit`
   - Payload: `{ ref_no, bankAccount, ifsc, pan, address }`

2. **Approve KYC** (Admin only): `POST /kyc/approve`
   - Payload: `{ ref_no }`

3. **Get Beneficiary Status**: `GET /kyc/beneficiary/:memberId`
   - Response: `{ kycStatus, beneficiaryStatus, beneficiaryId }`

4. **Initiate Payout**: `POST /kyc/payout`
   - Payload: `{ memberId, amount, transferId }`

## 6. Status Display Logic

Implement the following status display logic in your UI:

- **KYC Pending**: Show "KYC Pending Verification"
- **KYC Approved, Beneficiary Not Created**: Show "KYC Approved – Beneficiary Creating…"
- **KYC Approved, Beneficiary Created**: Show "Account Verified – Ready for Payouts"
- **KYC Rejected**: Show "KYC Rejected – Please Contact Support"

This provides users with clear feedback about their account status and what actions they can take.