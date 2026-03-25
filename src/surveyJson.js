export const surveyJson = {
  title: "Contact Form",
  pages: [
    {
      elements: [
        {
          type: "text",
          name: "full_name",
          title: "Full Name",
          isRequired: true
        },
        {
          type: "text",
          name: "email",
          title: "Email Address",
          inputType: "email",
          isRequired: true
        },
        {
          type: "dropdown",
          name: "department",
          title: "Department",
          choices: ["HR", "Finance", "IT", "Operations"]
        },
        {
          type: "comment",
          name: "message",
          title: "Your Message"
        }
      ]
    }
  ]
};