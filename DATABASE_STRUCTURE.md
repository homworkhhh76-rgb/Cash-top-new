# Database Structure - Oscar POS v4

```text
companies/{companyKey}
  active: true
  subscriptionEnd: "2099-12-31"
  storeName: "أوسكار"

companies/{companyKey}/admin/main
  username
  passwordHash
  passwordSalt
  lastLogin

companies/{companyKey}/employees/{employeeId}
  id, name, username, passwordHash, passwordSalt, active, permissions, createdAt, lastLogin

companies/{companyKey}/data/accounts/{id}
companies/{companyKey}/data/products/{id}
companies/{companyKey}/data/customers/{id}
companies/{companyKey}/data/suppliers/{id}
companies/{companyKey}/data/invoices/{id}
companies/{companyKey}/data/expenses/{id}
companies/{companyKey}/data/activity/{id}
companies/{companyKey}/data/inventory/{id}
companies/{companyKey}/data/settings/main
companies/{companyKey}/data/scannerSessions/{id}
companies/{companyKey}/data/scannerEvents/{id}
```

كل حركة حساب تحتوي `kind`, `amount`, `note`, `date` حتى يظهر الداخل والخارج لكل حساب.


## Firebase Realtime Database v5
المسارات المستخدمة:

```text
companies/
  COMPANY001/
    active
    subscriptionEnd
    admin/main
    employees/{employeeId}
    data/
      products/{id}
      customers/{id}
      suppliers/{id}
      accounts/{id}
      invoices/{id}
      expenses/{id}
      activity/{id}
      inventory/{id}
      notifications/{id}
      settings/main
      scannerSessions/{id}
      scannerEvents/{id}
```
