using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.Primitives;

namespace HasuraStarter.Pages
{
    public class PasswordResetModel : PageModel
    {
        [BindProperty(SupportsGet = true)]
        public string Token { get; set; } = "";

        public string Error { get; set; } = String.Empty;

        public bool HideForm { get; set; } = false;

        public async Task OnGetAsync()
        {
            try
            {
                var user = await UserGraphQL.GetUserByPasswordResetToken(Token);
            } catch (Exception)
            {
                Error = "Invalid token!";
                HideForm = true;
            }
        }

        public async Task<IActionResult> OnPostAsync()
        {
            try
            {
                
                var user = await UserGraphQL.GetUserByPasswordResetToken(Token);

                StringValues password = "";
                StringValues passwordConfirmation = "";

                Request.Form.TryGetValue("password", out password);
                Request.Form.TryGetValue("password_confirmation", out passwordConfirmation);
                string hashedPassword = AuthCrypt.HashPassword(password);

                if(string.IsNullOrEmpty(password))
                {
                    throw new InvalidOperationException("Password is required!");
                }
                if (string.IsNullOrEmpty(passwordConfirmation))
                {
                    throw new InvalidOperationException("Password confirmation is required!");
                }
                if (password.ToString().Length < 5)
                {
                    throw new InvalidOperationException("Password must be at least 5 characters long.");
                }
                if (password != passwordConfirmation)
                {
                    throw new InvalidOperationException("Passwords did not match!");
                }

                await UserGraphQL.ChangeUserPassword(user.id, hashedPassword);

                return RedirectToPage("./PasswordResetSuccess");
            }
            catch (Exception ex)
            {
                Error = "Failed to update password : " + ex.Message;
            }
            
            return Page();
        }
    }
}
